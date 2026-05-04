import { DatabaseSync, type SQLInputValue } from 'node:sqlite';
import { Kysely, SqliteDialect, type SqliteDatabase, type SqliteStatement } from 'kysely';
import type { TaskStatus } from '../../../domain/task/task-status.ts';

export type TasksRow = {
  id: string;
  title: string;
  status: TaskStatus;
  created_at: string;
  updated_at: string;
};

export type TaskDb = {
  tasks: TasksRow;
};

const IN_MEMORY_PATH = ':memory:';

/**
 * Adapt a node:sqlite `DatabaseSync` to the better-sqlite3-shaped interface
 * Kysely's built-in `SqliteDialect` expects.
 *
 * `reader` is derived from prepared-statement metadata (`columns().length > 0`)
 * rather than parsing SQL — robust against CTEs, RETURNING clauses, and any
 * future query Kysely emits.
 */
const wrapNodeSqlite = (db: DatabaseSync): SqliteDatabase => ({
  close: () => db.close(),
  prepare: (sql: string): SqliteStatement => {
    const stmt = db.prepare(sql);
    return {
      reader: stmt.columns().length > 0,
      all: (params) => stmt.all(...(params as readonly SQLInputValue[])) as unknown[],
      run: (params) => {
        const r = stmt.run(...(params as readonly SQLInputValue[]));
        return { changes: Number(r.changes), lastInsertRowid: Number(r.lastInsertRowid) };
      },
      iterate: function* (params) {
        for (const row of stmt.iterate(...(params as readonly SQLInputValue[]))) yield row;
      },
    };
  },
});

export type DatabaseHandle = {
  kysely: Kysely<TaskDb>;
};

export type OpenDatabaseOptions = {
  path: string;
};

export const openDatabase = ({ path }: OpenDatabaseOptions): DatabaseHandle => {
  const sqlite = new DatabaseSync(path);
  // WAL is meaningful only on file-backed databases; :memory: rejects it silently
  // but issuing it is cosmetic noise.
  if (path !== IN_MEMORY_PATH) {
    sqlite.exec('PRAGMA journal_mode = WAL;');
  }
  sqlite.exec('PRAGMA foreign_keys = ON;');
  const kysely = new Kysely<TaskDb>({
    dialect: new SqliteDialect({ database: wrapNodeSqlite(sqlite) }),
  });
  return { kysely };
};
