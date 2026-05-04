import { ok, type Result } from '../../domain/shared/result.ts';
import type { TaskNotFound, ValidationError } from '../../domain/task/errors.ts';
import type { TaskRepository } from '../ports/task-repository.ts';
import { loadTaskById } from './_load-task.ts';

export type DeleteTaskInput = { id: string };
export type DeleteTaskDeps = { tasks: TaskRepository };
export type DeleteTaskError = ValidationError | TaskNotFound;

export const deleteTask = async (
  input: DeleteTaskInput,
  deps: DeleteTaskDeps,
): Promise<Result<void, DeleteTaskError>> => {
  const existing = await loadTaskById(input.id, deps.tasks);
  if (!existing.ok) return existing;

  await deps.tasks.delete(existing.value.id);
  return ok(undefined);
};
