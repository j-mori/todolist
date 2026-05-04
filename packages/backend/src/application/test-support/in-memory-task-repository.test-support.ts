import type { TaskRepository } from '../ports/task-repository.ts';
import type { Task } from '../../domain/task/task.ts';
import type { TaskId } from '../../domain/task/task-id.ts';

export type InMemoryTaskRepository = TaskRepository & {
  readonly saveCalls: Task[];
  readonly deleteCalls: TaskId[];
  seed(...tasks: Task[]): void;
  contents(): Task[];
};

export const createInMemoryTaskRepository = (): InMemoryTaskRepository => {
  const store = new Map<TaskId, Task>();
  const saveCalls: Task[] = [];
  const deleteCalls: TaskId[] = [];

  return {
    saveCalls,
    deleteCalls,
    async save(task) {
      saveCalls.push(task);
      store.set(task.id, task);
    },
    async findById(id) {
      return store.get(id) ?? null;
    },
    async list() {
      return [...store.values()];
    },
    async delete(id) {
      deleteCalls.push(id);
      store.delete(id);
    },
    seed(...tasks) {
      for (const t of tasks) store.set(t.id, t);
    },
    contents() {
      return [...store.values()];
    },
  };
};
