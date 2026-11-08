import { randomBytes } from "node:crypto";
import type { Redis } from "ioredis";

export class ComponentState {
  constructor(
    private redis: Redis,
    private prefix = "clan:cmp",
  ) {}

  async create<S>(data: S, ttlSec: number) {
    const key = randomBytes(8).toString("base64url");
    await this.redis.set(this.#key(key), JSON.stringify(data), "EX", ttlSec);
    return key;
  }

  async get<S>(key: string) {
    return this.#parse<S>(await this.redis.get(this.#key(key)));
  }

  async take<S>(key: string) {
    return this.#parse<S>(await this.redis.getdel(this.#key(key)));
  }

  async update<S>(key: string, data: S) {
    const result = await this.redis.set(this.#key(key), JSON.stringify(data), "KEEPTTL", "XX");
    return result === "OK";
  }

  async drop(key: string) {
    await this.redis.del(this.#key(key));
  }

  #key(key: string) {
    return `${this.prefix}:${key}`;
  }

  #parse<S>(raw: string | null) {
    return raw === null ? null : (JSON.parse(raw) as S);
  }
}
