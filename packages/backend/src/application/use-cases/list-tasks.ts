import type { Task } from '../../domain/task/task.ts';
import type { TaskRepository } from '../ports/task-repository.ts';

export type ListTasksDeps = { tasks: TaskRepository };

export const listTasks = async (deps: ListTasksDeps): Promise<Task[]> => {
  const all = await deps.tasks.list();
  return [...all].sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
};
