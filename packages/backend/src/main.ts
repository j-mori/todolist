import type { Logger } from 'pino';
import type { Clock } from './application/ports/clock.ts';
import type { IdGenerator } from './application/ports/id-generator.ts';
import type { TaskRepository } from './application/ports/task-repository.ts';
import { type App, createApp, type ReadinessProbe } from './adapters/http/app.ts';
import { openDatabase } from './adapters/persistence/sqlite/db.ts';
import { initSchema } from './adapters/persistence/sqlite/schema.ts';
import { createSqliteTaskRepository } from './adapters/persistence/sqlite/task-repository.ts';
import { mintTaskId } from './domain/task/task-id-mint.ts';
import { sql } from 'kysely';

/**
 * Production defaults for the deterministic ports. Exported for callers that
 * want the same wiring without going through {@link composeProduction}.
 */
export const productionClock: Clock = { now: () => new Date() };
export const productionIdGenerator: IdGenerator = {
  next: () => mintTaskId(crypto.randomUUID()),
};

export type ComposedApp = {
  app: App;
  dispose(): Promise<void>;
};

/**
 * Wire a fully-configured app from explicit dependencies.
 *
 * Every port is required and supplied by the caller — no hidden defaults.
 * Use {@link composeProduction} to get the standard production wiring,
 * or call this directly from tests with whatever fakes you need.
 */
export const compose = (deps: {
  tasks: TaskRepository;
  clock: Clock;
  ids: IdGenerator;
  logger: Logger;
  corsOrigin: string | string[];
  maxBodyBytes: number;
  readiness?: ReadinessProbe;
  dispose?: () => Promise<void>;
}): ComposedApp => {
  const app = createApp({
    tasks: deps.tasks,
    clock: deps.clock,
    ids: deps.ids,
    logger: deps.logger,
    corsOrigin: deps.corsOrigin,
    maxBodyBytes: deps.maxBodyBytes,
    ...(deps.readiness ? { readiness: deps.readiness } : {}),
  });
  return {
    app,
    dispose: deps.dispose ?? (async () => undefined),
  };
};

export type ComposeProductionOptions = {
  databasePath: string;
  logger: Logger;
  corsOrigin: string | string[];
  maxBodyBytes: number;
  /** Optional clock override; defaults to {@link productionClock}. */
  clock?: Clock;
  /** Optional id-generator override; defaults to {@link productionIdGenerator}. */
  ids?: IdGenerator;
};

/**
 * Standard production wiring: opens a SQLite database, initialises the schema,
 * and mounts the SQLite-backed task repository. Returns a `dispose` that
 * cleanly closes the database (used both by the production server's signal
 * handlers and by integration tests).
 */
export const composeProduction = async (opts: ComposeProductionOptions): Promise<ComposedApp> => {
  const handle = openDatabase({ path: opts.databasePath });
  await initSchema(handle.kysely);
  const tasks = createSqliteTaskRepository(handle.kysely);
  const readiness: ReadinessProbe = {
    check: async () => {
      await sql`select 1`.execute(handle.kysely);
    },
  };
  return compose({
    tasks,
    clock: opts.clock ?? productionClock,
    ids: opts.ids ?? productionIdGenerator,
    logger: opts.logger,
    corsOrigin: opts.corsOrigin,
    maxBodyBytes: opts.maxBodyBytes,
    readiness,
    dispose: () => handle.kysely.destroy(),
  });
};
