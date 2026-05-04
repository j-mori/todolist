import { Task } from './task.ts';
import { TaskId } from './task-id.ts';
import type { TaskStatus } from './task-status.ts';
import { TaskTitle } from './task-title.ts';

export const idOf = (s: string): TaskId => {
  const r = TaskId.from(s);
  if (!r.ok) throw new Error(`test fixture: invalid TaskId "${s}"`);
  return r.value;
};

export const titleOf = (s: string): TaskTitle => {
  const r = TaskTitle.from(s);
  if (!r.ok) throw new Error(`test fixture: invalid TaskTitle "${s}"`);
  return r.value;
};

export type TaskOf = {
  id: string;
  title: string;
  now: string;
  status?: TaskStatus;
};

/**
 * Build a fully-formed Task from primitive inputs for use in tests.
 *
 * Defaults to `pending`. Pass `status: 'completed'` to skip the explicit
 * `.complete()` chain when the test doesn't care about the transition.
 */
export const taskOf = (input: TaskOf): Task => {
  const created = Task.create({
    id: idOf(input.id),
    title: titleOf(input.title),
    now: new Date(input.now),
  });
  if (input.status === 'completed') {
    return created.complete(new Date(input.now));
  }
  return created;
};

/** Reusable id literals so individual tests don't redeclare them. */
export const TASK_IDS = {
  A: '11111111-1111-4111-8111-111111111111',
  B: '22222222-2222-4222-8222-222222222222',
  C: '33333333-3333-4333-8333-333333333333',
  X: '550e8400-e29b-41d4-a716-446655440000',
  UNKNOWN: '99999999-9999-4999-8999-999999999999',
} as const;
