import type { Task as ApiTask } from '@todolist/shared';
import type { Task } from '../../domain/task/task.ts';

/**
 * Project a domain {@link Task} onto its wire-level representation.
 *
 * The two types deliberately diverge on date fields: the domain holds `Date`
 * instances; the wire holds ISO 8601 strings (JSON has no native date type).
 */
export const taskToWire = (task: Task): ApiTask => ({
  id: task.id,
  title: task.title,
  status: task.status,
  createdAt: task.createdAt.toISOString(),
  updatedAt: task.updatedAt.toISOString(),
});
