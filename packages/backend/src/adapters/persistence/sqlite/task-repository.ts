import type { Kysely } from 'kysely';
import type { Task } from '../../../domain/task/task.ts';
import type { TaskId } from '../../../domain/task/task-id.ts';
import type { TaskRepository } from '../../../application/ports/task-repository.ts';
import type { TaskDb } from './db.ts';
import { rowToTask, taskToRow } from './task-row.ts';

export const createSqliteTaskRepository = (db: Kysely<TaskDb>): TaskRepository => ({
  async save(task: Task): Promise<void> {
    const row = taskToRow(task);
    await db
      .insertInto('tasks')
      .values(row)
      .onConflict((oc) =>
        oc.column('id').doUpdateSet({
          title: row.title,
          status: row.status,
          updated_at: row.updated_at,
        }),
      )
      .execute();
  },

  async findById(id: TaskId): Promise<Task | null> {
    const row = await db.selectFrom('tasks').selectAll().where('id', '=', id).executeTakeFirst();
    return row ? rowToTask(row) : null;
  },

  async list(): Promise<Task[]> {
    const rows = await db.selectFrom('tasks').selectAll().orderBy('created_at', 'desc').execute();
    return rows.map(rowToTask);
  },

  async delete(id: TaskId): Promise<void> {
    await db.deleteFrom('tasks').where('id', '=', id).execute();
  },
});
