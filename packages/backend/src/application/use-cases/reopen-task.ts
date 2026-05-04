import { err, ok, type Result } from '../../domain/shared/result.ts';
import { taskNotFound, type TaskNotFound, type ValidationError } from '../../domain/task/errors.ts';
import type { Task } from '../../domain/task/task.ts';
import { TaskId } from '../../domain/task/task-id.ts';
import type { Clock } from '../ports/clock.ts';
import type { TaskRepository } from '../ports/task-repository.ts';

export type ReopenTaskInput = { id: string };
export type ReopenTaskDeps = { tasks: TaskRepository; clock: Clock };
export type ReopenTaskError = ValidationError | TaskNotFound;

export const reopenTask = async (
  input: ReopenTaskInput,
  deps: ReopenTaskDeps,
): Promise<Result<Task, ReopenTaskError>> => {
  const id = TaskId.from(input.id);
  if (!id.ok) return err(id.error);

  const existing = await deps.tasks.findById(id.value);
  if (existing === null) return err(taskNotFound(input.id));

  const reopened = existing.reopen(deps.clock.now());
  if (reopened !== existing) {
    await deps.tasks.save(reopened);
  }
  return ok(reopened);
};
