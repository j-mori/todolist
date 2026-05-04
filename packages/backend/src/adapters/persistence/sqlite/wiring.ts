import { sql } from 'kysely';
import type { TaskRepository } from '../../../application/ports/task-repository.ts';
import type { ReadinessProbe } from '../../http/app.ts';
import { openDatabase } from './db.ts';
import { initSchema } from './schema.ts';
import { createSqliteTaskRepository } from './task-repository.ts';

export type WiredDatabase = {
  repo: TaskRepository;
  readiness: ReadinessProbe;
  dispose(): Promise<void>;
};

/**
 * Open a SQLite database, run schema init, and return the wired
 * `TaskRepository`, a readiness probe, and a `dispose` that closes the
 * underlying handle. Used by both the production entrypoint and the
 * integration test helper so the wiring stays in one place.
 */
export const openWiredDatabase = async (path: string): Promise<WiredDatabase> => {
  const handle = openDatabase({ path });
  await initSchema(handle.kysely);
  return {
    repo: createSqliteTaskRepository(handle.kysely),
    readiness: {
      check: async () => {
        await sql`select 1`.execute(handle.kysely);
      },
    },
    dispose: () => handle.kysely.destroy(),
  };
};
