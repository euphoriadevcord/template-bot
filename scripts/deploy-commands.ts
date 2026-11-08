import { REST, Routes } from "discord.js";
import { createApp } from "@/app";
import { loadConfig } from "@/config/env";
import { logger } from "@/lib/logger";

const config = loadConfig();
const { registry, close } = await createApp(config);

const body = [...registry.commands.values()].map((command) => command.data.toJSON());

await new REST()
  .setToken(config.token)
  .put(Routes.applicationGuildCommands(config.clientId, config.guildId), { body });

logger.info({ commands: body.map((c) => c.name) }, "commands deployed");
await close();
