import { Events } from "discord.js";
import { createApp } from "@/app";
import { loadConfig } from "@/config/env";
import { attachDispatcher } from "@/core/dispatcher";
import { logger } from "@/lib/logger";
import { Scheduler } from "@/runtime/scheduler";

const config = loadConfig();
const { ctx, registry, close } = await createApp(config);

await ctx.redis.connect();
attachDispatcher(registry, ctx);

const scheduler = new Scheduler(logger);

ctx.client.once(Events.ClientReady, (ready) => {
  logger.info(`logged in as ${ready.user.tag}`);
  scheduler.start(registry.jobs);
});

let stopping = false;
const shutdown = async () => {
  if (stopping) return;
  stopping = true;
  logger.info("shutting down");
  await scheduler.stop();
  await close();
  process.exit(0);
};

process.once("SIGINT", shutdown);
process.once("SIGTERM", shutdown);

await ctx.client.login(config.token);
