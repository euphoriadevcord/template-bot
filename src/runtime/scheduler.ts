import type { Logger } from "pino";
import type { ScheduledJob } from "@/core/loader";

export class Scheduler {
  #timers = new Map<string, ReturnType<typeof setTimeout>>();
  #inFlight = new Set<Promise<void>>();
  #stopped = false;

  constructor(private logger: Logger) {}

  start(jobs: ScheduledJob[]) {
    for (const s of jobs) {
      this.schedule(s, s.job.runOnStart === false ? s.job.intervalSec * 1000 : 0);
    }

    this.logger.info({ jobs: jobs.map((j) => j.id) }, "scheduler started");
  }

  async stop() {
    this.#stopped = true;

    for (const timer of this.#timers.values()) clearTimeout(timer);

    await Promise.allSettled(this.#inFlight);
  }

  private schedule(s: ScheduledJob, delayMs: number) {
    if (this.#stopped) return;

    this.#timers.set(
      s.id,
      setTimeout(() => {
        const run: Promise<void> = s.job
          .run(s.ctx)
          .catch((err) => s.ctx.logger.error({ err, job: s.id }, "job failed"))
          .finally(() => {
            this.#inFlight.delete(run);
            this.schedule(s, s.job.intervalSec * 1000);
          });
          
        this.#inFlight.add(run);
      }, delayMs),
    );
  }
}
