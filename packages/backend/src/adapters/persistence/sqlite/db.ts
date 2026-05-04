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

const isReaderSql = (sql: string): boolean => {
  const head = sql.trimStart().toUpperCase();
  return (
    head.startsWith('SELECT') ||
    head.startsWith('PRAGMA') ||
    head.startsWith('EXPLAIN') ||
    head.startsWith('WITH') ||
    /\bRETURNING\b/.test(head)
  );
};

const wrapNodeSqlite = (db: DatabaseSync): SqliteDatabase => ({
  close: () => db.close(),
  prepare: (sql: string): SqliteStatement => {
    const stmt = db.prepare(sql);
    return {
      reader: isReaderSql(sql),
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
  close(): void;
};

export const openDatabase = (path: string): DatabaseHandle => {
  const sqlite = new DatabaseSync(path);
  sqlite.exec('PRAGMA journal_mode = WAL;');
  sqlite.exec('PRAGMA foreign_keys = ON;');
  const kysely = new Kysely<TaskDb>({ dialect: new SqliteDialect({ database: wrapNodeSqlite(sqlite) }) });
  return {
    kysely,
    close: () => sqlite.close(),
  };
};
