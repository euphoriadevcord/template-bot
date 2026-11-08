import type { AppContext } from "@/core/context";
import { defineJob } from "@/core/define";
import { claimDue, complete, retry, type OutboxKind, type OutboxTasks } from "./store";

export type OutboxHandlers = {
  [K in OutboxKind]: (payload: OutboxTasks[K], ctx: AppContext) => Promise<void>;
};

const BATCH = 20;

export const outboxWorker = (handlers: OutboxHandlers) =>
  defineJob({
    name: "outbox",
    intervalSec: 5,
    async run(ctx) {
      for (const task of await claimDue(ctx.db, BATCH)) {
        const handler = handlers[task.kind as OutboxKind];
        if (!handler) {
          await retry(ctx.db, task.id, task.attempts, `unknown kind ${task.kind}`);
          continue;
        }

        try {
          await handler(task.payload as never, ctx);
          await complete(ctx.db, task.id);
        } catch (err) {
          ctx.logger.warn({ err, task: task.id, kind: task.kind }, "outbox task failed");
          await retry(ctx.db, task.id, task.attempts, String(err));
        }
      }
    },
  });
