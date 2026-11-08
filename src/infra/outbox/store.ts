import { and, asc, eq, lte, sql } from "drizzle-orm";
import type { Db, Tx } from "@/infra/db/client";
import { outbox } from "@/infra/db/schema";

export interface OutboxTasks {
  "discord.role.add": { guildId: string; userId: string; roleId: string };
  "discord.role.remove": { guildId: string; userId: string; roleId: string };
}

export type OutboxKind = keyof OutboxTasks;

const MAX_ATTEMPTS = 10;
const LEASE = sql`now() + interval '1 minute'`;

export const enqueue = async <K extends OutboxKind>(
  tx: Tx,
  kind: K,
  payload: OutboxTasks[K],
  idempotencyKey?: string,
) => {
  await tx.insert(outbox).values({ kind, payload, idempotencyKey }).onConflictDoNothing();
};

export const claimDue = (db: Db, limit: number) =>
  db.transaction(async (tx) => {
    const tasks = await tx
      .select()
      .from(outbox)
      .where(and(eq(outbox.status, "pending"), lte(outbox.nextAttemptAt, sql`now()`)))
      .orderBy(asc(outbox.id))
      .limit(limit)
      .for("update", { skipLocked: true });

    for (const task of tasks) {
      await tx.update(outbox).set({ nextAttemptAt: LEASE }).where(eq(outbox.id, task.id));
    }

    return tasks;
  });

export const complete = (db: Db, id: number) =>
  db.update(outbox).set({ status: "done" }).where(eq(outbox.id, id));

export const retry = (db: Db, id: number, attempts: number, error: string) => {
  const next = attempts + 1;
  const delaySec = Math.min(2 ** attempts * 5, 3600);
  return db
    .update(outbox)
    .set({
      attempts: next,
      lastError: error,
      status: next >= MAX_ATTEMPTS ? "dead" : "pending",
      nextAttemptAt: sql`now() + make_interval(secs => ${delaySec})`,
    })
    .where(eq(outbox.id, id));
};
