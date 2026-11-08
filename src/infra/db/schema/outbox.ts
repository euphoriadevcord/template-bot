import { index, integer, jsonb, snakeCase, text, timestamp } from "drizzle-orm/pg-core";

export const outboxStatus = ["pending", "done", "dead"] as const;

export const outbox = snakeCase.table(
  "outbox",
  {
    id: integer().primaryKey().generatedAlwaysAsIdentity(),
    kind: text().notNull(),
    payload: jsonb().$type<Record<string, unknown>>().notNull(),
    idempotencyKey: text().unique(),
    status: text({ enum: outboxStatus }).notNull().default("pending"),
    attempts: integer().notNull().default(0),
    nextAttemptAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
    lastError: text(),
    createdAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("outbox_due").on(t.status, t.nextAttemptAt)],
);
