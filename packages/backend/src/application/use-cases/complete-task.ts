import { ok, type Result } from '../../domain/shared/result.ts';
import type { TaskNotFound, ValidationError } from '../../domain/task/errors.ts';
import type { Task } from '../../domain/task/task.ts';
import type { Clock } from '../ports/clock.ts';
import type { TaskRepository } from '../ports/task-repository.ts';
import { loadTaskById } from './_load-task.ts';

export type CompleteTaskInput = { id: string };
export type CompleteTaskDeps = { tasks: TaskRepository; clock: Clock };
export type CompleteTaskError = ValidationError | TaskNotFound;

export const completeTask = async (
  input: CompleteTaskInput,
  deps: CompleteTaskDeps,
): Promise<Result<Task, CompleteTaskError>> => {
  const existing = await loadTaskById(input.id, deps.tasks);
  if (!existing.ok) return existing;

  const completed = existing.value.complete(deps.clock.now());
  if (completed !== existing.value) {
    await deps.tasks.save(completed);
  }
  return ok(completed);
};
