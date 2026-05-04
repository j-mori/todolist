import { err, ok, type Result } from '../../domain/shared/result.ts';
import type { TaskNotFound, ValidationError } from '../../domain/task/errors.ts';
import type { Task } from '../../domain/task/task.ts';
import { TaskTitle } from '../../domain/task/task-title.ts';
import type { Clock } from '../ports/clock.ts';
import type { TaskRepository } from '../ports/task-repository.ts';
import { loadTaskById } from './_load-task.ts';

export type UpdateTaskInput = { id: string; title: string };
export type UpdateTaskDeps = { tasks: TaskRepository; clock: Clock };
export type UpdateTaskError = ValidationError | TaskNotFound;

export const updateTask = async (
  input: UpdateTaskInput,
  deps: UpdateTaskDeps,
): Promise<Result<Task, UpdateTaskError>> => {
  const title = TaskTitle.from(input.title);
  if (!title.ok) return err(title.error);

  const existing = await loadTaskById(input.id, deps.tasks);
  if (!existing.ok) return existing;

  const updated = existing.value.withTitle(title.value, deps.clock.now());
  if (updated !== existing.value) {
    await deps.tasks.save(updated);
  }
  return ok(updated);
};
