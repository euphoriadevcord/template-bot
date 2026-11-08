import { Client } from "discord.js";
import { Redis } from "ioredis";
import type { Config } from "@/config/env";
import type { AppContext } from "@/core/context";
import { collectIntents, loadModules } from "@/core/loader";
import { createDb } from "@/infra/db/client";
import { ComponentState } from "@/infra/redis/state";
import { logger } from "@/lib/logger";
import { modules } from "@/modules";
import { EventBus } from "@/runtime/bus";

export const createApp = async (config: Config) => {
  const { db, pool } = createDb(config.databaseUrl);
  const redis = new Redis(config.redisUrl, { maxRetriesPerRequest: 3, lazyConnect: true });
  const client = new Client({ intents: collectIntents(modules) });

  const ctx: AppContext = {
    client: client as Client<true>,
    db,
    redis,
    bus: new EventBus(logger),
    state: new ComponentState(redis),
    logger,
    config,
  };

  const registry = await loadModules(modules, ctx);

  const close = async () => {
    ctx.bus.clear();
    await client.destroy();
    redis.disconnect();
    await pool.end();
  };

  return { ctx, registry, close };
};
