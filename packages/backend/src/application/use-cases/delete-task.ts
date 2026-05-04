import { err, ok, type Result } from '../../domain/shared/result.ts';
import { taskNotFound, type TaskNotFound, type ValidationError } from '../../domain/task/errors.ts';
import { TaskId } from '../../domain/task/task-id.ts';
import type { TaskRepository } from '../ports/task-repository.ts';

export type DeleteTaskInput = { id: string };
export type DeleteTaskDeps = { tasks: TaskRepository };
export type DeleteTaskError = ValidationError | TaskNotFound;

export const deleteTask = async (
  input: DeleteTaskInput,
  deps: DeleteTaskDeps,
): Promise<Result<void, DeleteTaskError>> => {
  const id = TaskId.from(input.id);
  if (!id.ok) return err(id.error);

  const existing = await deps.tasks.findById(id.value);
  if (existing === null) return err(taskNotFound(input.id));

  await deps.tasks.delete(id.value);
  return ok(undefined);
};
