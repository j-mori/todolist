import type { Logger } from 'pino';
import type { Clock } from './application/ports/clock.ts';
import type { IdGenerator } from './application/ports/id-generator.ts';
import type { TaskRepository } from './application/ports/task-repository.ts';
import { type App, createApp, type ReadinessProbe } from './adapters/http/app.ts';
import { mintTaskId } from './domain/task/task-id-mint.ts';

/** Production-default clock; tests inject a {@link FixedClock} instead. */
export const productionClock: Clock = { now: () => new Date() };

/** Production-default id generator; tests inject a deterministic generator instead. */
export const productionIdGenerator: IdGenerator = {
  next: () => mintTaskId(crypto.randomUUID()),
};

export type ComposeDeps = {
  tasks: TaskRepository;
  clock: Clock;
  ids: IdGenerator;
  logger: Logger;
  corsOrigin: string | string[];
  maxBodyBytes: number;
  readiness?: ReadinessProbe;
};

export type ComposedApp = {
  app: App;
};

/**
 * Composition root: wire a fully-configured app from explicit dependencies.
 *
 * Every port is required and supplied by the caller — no hidden defaults.
 * The entrypoint (`index.ts`) and the integration test helper both call this
 * directly, each constructing the dependencies it needs.
 */
export const compose = (deps: ComposeDeps): ComposedApp => {
  const app = createApp({
    tasks: deps.tasks,
    clock: deps.clock,
    ids: deps.ids,
    logger: deps.logger,
    corsOrigin: deps.corsOrigin,
    maxBodyBytes: deps.maxBodyBytes,
    ...(deps.readiness ? { readiness: deps.readiness } : {}),
  });
  return { app };
};
