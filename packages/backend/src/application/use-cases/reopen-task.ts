import { ok, type Result } from '../../domain/shared/result.ts';
import type { TaskNotFound, ValidationError } from '../../domain/task/errors.ts';
import type { Task } from '../../domain/task/task.ts';
import type { Clock } from '../ports/clock.ts';
import type { TaskRepository } from '../ports/task-repository.ts';
import { loadTaskById } from './_load-task.ts';

export type ReopenTaskInput = { id: string };
export type ReopenTaskDeps = { tasks: TaskRepository; clock: Clock };
export type ReopenTaskError = ValidationError | TaskNotFound;

export const reopenTask = async (
  input: ReopenTaskInput,
  deps: ReopenTaskDeps,
): Promise<Result<Task, ReopenTaskError>> => {
  const existing = await loadTaskById(input.id, deps.tasks);
  if (!existing.ok) return existing;

  const reopened = existing.value.reopen(deps.clock.now());
  if (reopened !== existing.value) {
    await deps.tasks.save(reopened);
  }
  return ok(reopened);
};
