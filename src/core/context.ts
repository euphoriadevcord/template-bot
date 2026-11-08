import type { Client } from "discord.js";
import type { Redis } from "ioredis";
import type { Logger } from "pino";
import type { Config } from "@/config/env";
import type { Db } from "@/infra/db/client";
import type { ComponentState } from "@/infra/redis/state";
import type { EventBus } from "@/runtime/bus";

export interface AppContext {
  client: Client<true>;
  db: Db;
  redis: Redis;
  bus: EventBus;
  state: ComponentState;
  logger: Logger;
  config: Config;
}
