import type { Task } from '../../domain/task/task.ts';
import type { TaskId } from '../../domain/task/task-id.ts';

/**
 * Persistence port for {@link Task}.
 *
 * Implementations are responsible for the contract specified per-method;
 * use cases depend on these guarantees rather than re-asserting them.
 */
export type TaskRepository = {
  /** Insert or replace the task. Idempotent under repeated calls with the same value. */
  save(task: Task): Promise<void>;
  /** Look up by id. Returns `null` (never throws) for absence. */
  findById(id: TaskId): Promise<Task | null>;
  /** All tasks in {@link Task.createdAt}-descending order. Empty array when none. */
  list(): Promise<Task[]>;
  /** Remove the task. No-op when the id is unknown — use cases handle the 404 case. */
  delete(id: TaskId): Promise<void>;
};
