import type { Kysely } from 'kysely';
import { sql } from 'kysely';
import type { TaskDb } from './db.ts';

const STATEMENTS = [
  `CREATE TABLE IF NOT EXISTS tasks (
     id TEXT PRIMARY KEY,
     title TEXT NOT NULL,
     status TEXT NOT NULL CHECK (status IN ('pending', 'completed')),
     created_at TEXT NOT NULL,
     updated_at TEXT NOT NULL
   )`,
  'CREATE INDEX IF NOT EXISTS idx_tasks_created_at ON tasks (created_at DESC)',
];

export const initSchema = async (db: Kysely<TaskDb>): Promise<void> => {
  for (const stmt of STATEMENTS) {
    await sql.raw(stmt).execute(db);
  }
};
