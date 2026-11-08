import type { Redis } from "ioredis";

export class Cooldowns {
  constructor(
    private redis: Redis,
    private prefix = "clan:cd",
  ) {}

  async claim(key: string, seconds: number) {
    const result = await this.redis.set(`${this.prefix}:${key}`, "1", "EX", seconds, "NX");
    return result === "OK";
  }

  async remaining(key: string) {
    const ms = await this.redis.pttl(`${this.prefix}:${key}`);
    return ms > 0 ? ms : 0;
  }
}
