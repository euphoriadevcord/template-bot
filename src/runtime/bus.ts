import { EventEmitter } from "node:events";
import type { Logger } from "pino";

export interface EventMap {
  exampleEvent: { message: string };
}

export class EventBus {
  #emitter = new EventEmitter();

  constructor(private logger: Logger) {}

  emit<K extends keyof EventMap>(event: K, payload: EventMap[K]) {
    this.#emitter.emit(event, payload);
  }

  on<K extends keyof EventMap>(event: K, fn: (payload: EventMap[K]) => Promise<void>) {
    this.#emitter.on(event, (payload: EventMap[K]) => {
      fn(payload).catch((err) => this.logger.error({ err, event }, "listener failed"));
    });
  }

  clear() {
    this.#emitter.removeAllListeners();
  }
}
