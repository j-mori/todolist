import { err, ok, type Result } from '../../domain/shared/result.ts';
import { taskNotFound, type TaskNotFound, type ValidationError } from '../../domain/task/errors.ts';
import type { Task } from '../../domain/task/task.ts';
import { TaskId } from '../../domain/task/task-id.ts';
import { TaskTitle } from '../../domain/task/task-title.ts';
import type { Clock } from '../ports/clock.ts';
import type { TaskRepository } from '../ports/task-repository.ts';

export type UpdateTaskInput = { id: string; title: string };
export type UpdateTaskDeps = { tasks: TaskRepository; clock: Clock };
export type UpdateTaskError = ValidationError | TaskNotFound;

export const updateTask = async (
  input: UpdateTaskInput,
  deps: UpdateTaskDeps,
): Promise<Result<Task, UpdateTaskError>> => {
  const id = TaskId.from(input.id);
  if (!id.ok) return err(id.error);

  const title = TaskTitle.from(input.title);
  if (!title.ok) return err(title.error);

  const existing = await deps.tasks.findById(id.value);
  if (existing === null) return err(taskNotFound(input.id));

  const updated = existing.withTitle(title.value, deps.clock.now());
  await deps.tasks.save(updated);
  return ok(updated);
};
