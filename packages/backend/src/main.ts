import type { Logger } from 'pino';
import { createApp } from './adapters/http/app.ts';
import { openDatabase, type DatabaseHandle } from './adapters/persistence/sqlite/db.ts';
import { initSchema } from './adapters/persistence/sqlite/schema.ts';
import { createSqliteTaskRepository } from './adapters/persistence/sqlite/task-repository.ts';
import { TaskId } from './domain/task/task-id.ts';

export type ComposeOptions = {
  databasePath: string;
  logger?: Logger;
  corsOrigin?: string | string[];
};

export type ComposedApp = {
  app: ReturnType<typeof createApp>;
  dispose(): Promise<void>;
};

export const compose = async (opts: ComposeOptions): Promise<ComposedApp> => {
  const handle: DatabaseHandle = openDatabase(opts.databasePath);
  await initSchema(handle.kysely);
  const tasks = createSqliteTaskRepository(handle.kysely);
  const clock = { now: () => new Date() };
  const ids = { next: () => TaskId.unsafe(crypto.randomUUID()) };
  const app = createApp({
    tasks,
    clock,
    ids,
    ...(opts.logger ? { logger: opts.logger } : {}),
    ...(opts.corsOrigin !== undefined ? { corsOrigin: opts.corsOrigin } : {}),
  });
  return {
    app,
    dispose: async () => {
      // Kysely.destroy() closes the underlying node:sqlite handle via SqliteDriver.destroy(),
      // so we must not also call handle.close() — that would error with ERR_INVALID_STATE.
      await handle.kysely.destroy();
    },
  };
};
