import { err, ok, type Result } from '../../domain/shared/result.ts';
import { taskNotFound, type TaskNotFound, type ValidationError } from '../../domain/task/errors.ts';
import type { Task } from '../../domain/task/task.ts';
import { TaskId } from '../../domain/task/task-id.ts';
import type { Clock } from '../ports/clock.ts';
import type { TaskRepository } from '../ports/task-repository.ts';

export type CompleteTaskInput = { id: string };
export type CompleteTaskDeps = { tasks: TaskRepository; clock: Clock };
export type CompleteTaskError = ValidationError | TaskNotFound;

export const completeTask = async (
  input: CompleteTaskInput,
  deps: CompleteTaskDeps,
): Promise<Result<Task, CompleteTaskError>> => {
  const id = TaskId.from(input.id);
  if (!id.ok) return err(id.error);

  const existing = await deps.tasks.findById(id.value);
  if (existing === null) return err(taskNotFound(input.id));

  const completed = existing.complete(deps.clock.now());
  if (completed !== existing) {
    await deps.tasks.save(completed);
  }
  return ok(completed);
};
