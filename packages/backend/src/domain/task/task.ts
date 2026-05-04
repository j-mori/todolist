import { __unsafeTaskId, type TaskId } from './task-id.ts';
import type { TaskStatus } from './task-status.ts';
import { __unsafeTaskTitle, type TaskTitle } from './task-title.ts';

export type Task = {
  readonly id: TaskId;
  readonly title: TaskTitle;
  readonly status: TaskStatus;
  readonly createdAt: Date;
  readonly updatedAt: Date;
  withTitle(title: TaskTitle, now: Date): Task;
  complete(now: Date): Task;
  reopen(now: Date): Task;
};

type TaskFields = Pick<Task, 'id' | 'title' | 'status' | 'createdAt' | 'updatedAt'>;

const make = (fields: TaskFields): Task => {
  const self: Task = {
    ...fields,
    withTitle(title, now) {
      if (title === fields.title) return self;
      return make({ ...fields, title, updatedAt: now });
    },
    complete(now) {
      if (fields.status === 'completed') return self;
      return make({ ...fields, status: 'completed', updatedAt: now });
    },
    reopen(now) {
      if (fields.status === 'pending') return self;
      return make({ ...fields, status: 'pending', updatedAt: now });
    },
  };
  return self;
};

const create = (input: { id: TaskId; title: TaskTitle; now: Date }): Task =>
  make({
    id: input.id,
    title: input.title,
    status: 'pending',
    createdAt: input.now,
    updatedAt: input.now,
  });

/**
 * Reconstruct a {@link Task} from a trusted row (typically the persistence
 * adapter reading data it wrote earlier).
 *
 * This bypasses the value-object smart constructors — the caller is asserting
 * that the `id` and `title` are already well-formed. Production callers are
 * limited to the persistence adapter and the SQLite-backed `IdGenerator`. Any
 * other call site must justify the assertion.
 */
const restore = (raw: {
  id: string;
  title: string;
  status: TaskStatus;
  createdAt: Date;
  updatedAt: Date;
}): Task =>
  make({
    id: __unsafeTaskId(raw.id),
    title: __unsafeTaskTitle(raw.title),
    status: raw.status,
    createdAt: raw.createdAt,
    updatedAt: raw.updatedAt,
  });

export const Task = { create, restore };
