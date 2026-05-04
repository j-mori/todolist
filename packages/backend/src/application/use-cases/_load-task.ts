import { err, ok, type Result } from '../../domain/shared/result.ts';
import { taskNotFound, type TaskNotFound, type ValidationError } from '../../domain/task/errors.ts';
import type { Task } from '../../domain/task/task.ts';
import { TaskId } from '../../domain/task/task-id.ts';
import type { TaskRepository } from '../ports/task-repository.ts';

/**
 * Validate the supplied id and load the corresponding task.
 *
 * Shared by the four single-task use cases (`updateTask`, `completeTask`,
 * `reopenTask`, `deleteTask`). Centralises the "validate id → look up → 404 if
 * missing" prelude so the use cases stay focused on their actual transition.
 */
export const loadTaskById = async (
  rawId: string,
  tasks: TaskRepository,
): Promise<Result<Task, ValidationError | TaskNotFound>> => {
  const id = TaskId.from(rawId);
  if (!id.ok) return err(id.error);

  const existing = await tasks.findById(id.value);
  if (existing === null) return err(taskNotFound(rawId));

  return ok(existing);
};
