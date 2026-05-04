import type { Task } from '../../domain/task/task.ts';
import type { TaskRepository } from '../ports/task-repository.ts';

export type ListTasksDeps = { tasks: TaskRepository };

/**
 * Returns all tasks. Ordering (createdAt desc) is part of the
 * {@link TaskRepository} port contract; the use case just delegates.
 */
export const listTasks = async (deps: ListTasksDeps): Promise<Task[]> => deps.tasks.list();
