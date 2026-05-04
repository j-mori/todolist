import type { TaskId } from './task-id.ts';
import type { TaskStatus } from './task-status.ts';
import type { TaskTitle } from './task-title.ts';

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

const restore = (fields: TaskFields): Task => make(fields);

export const Task = { create, restore };
