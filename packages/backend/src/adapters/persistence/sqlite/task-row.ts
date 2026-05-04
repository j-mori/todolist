import { Task } from '../../../domain/task/task.ts';
import type { TasksRow } from './db.ts';

export const rowToTask = (row: TasksRow): Task =>
  Task.restore({
    id: row.id,
    title: row.title,
    status: row.status,
    createdAt: new Date(row.created_at),
    updatedAt: new Date(row.updated_at),
  });

export const taskToRow = (task: Task): TasksRow => ({
  id: task.id,
  title: task.title,
  status: task.status,
  created_at: task.createdAt.toISOString(),
  updated_at: task.updatedAt.toISOString(),
});
