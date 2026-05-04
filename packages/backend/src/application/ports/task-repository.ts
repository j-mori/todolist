import type { Task } from '../../domain/task/task.ts';
import type { TaskId } from '../../domain/task/task-id.ts';

export type TaskRepository = {
  save(task: Task): Promise<void>;
  findById(id: TaskId): Promise<Task | null>;
  list(): Promise<Task[]>;
  delete(id: TaskId): Promise<void>;
};
