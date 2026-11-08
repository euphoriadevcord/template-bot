import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";

export const createDb = (url: string) => {
  const pool = new Pool({ connectionString: url });
  return { db: drizzle({ client: pool }), pool };
};

export type Db = ReturnType<typeof createDb>["db"];
export type Tx = Parameters<Parameters<Db["transaction"]>[0]>[0];

export const isUniqueViolation = (err: unknown) => {
  const e = err as { code?: string; cause?: { code?: string } };
  return e.code === "23505" || e.cause?.code === "23505";
};
