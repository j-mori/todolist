import { strict as assert } from 'node:assert';
import { describe, it } from 'node:test';
import { Task } from '../../domain/task/task.ts';
import { TaskId } from '../../domain/task/task-id.ts';
import { TaskTitle } from '../../domain/task/task-title.ts';
import { createFixedClock } from '../test-support/fixed-clock.test-support.ts';
import { createInMemoryTaskRepository } from '../test-support/in-memory-task-repository.test-support.ts';
import { reopenTask } from './reopen-task.ts';

const VALID_ID = '550e8400-e29b-41d4-a716-446655440000';
const id = (s: string) => {
  const r = TaskId.from(s);
  if (!r.ok) throw new Error('bad id');
  return r.value;
};
const title = (s: string) => {
  const r = TaskTitle.from(s);
  if (!r.ok) throw new Error('bad title');
  return r.value;
};

describe('reopenTask', () => {
  it('marks a completed task as pending and saves it', async () => {
    const tasks = createInMemoryTaskRepository();
    const clock = createFixedClock(new Date('2026-05-04T13:00:00Z'));
    const t0 = Task.create({
      id: id(VALID_ID),
      title: title('x'),
      now: new Date('2026-05-04T10:00:00Z'),
    });
    tasks.seed(t0.complete(new Date('2026-05-04T11:00:00Z')));

    const r = await reopenTask({ id: VALID_ID }, { tasks, clock });

    assert.equal(r.ok, true);
    if (!r.ok) return;
    assert.equal(r.value.status, 'pending');
    assert.equal(r.value.updatedAt.toISOString(), '2026-05-04T13:00:00.000Z');
    assert.equal(tasks.saveCalls.length, 1);
  });

  it('is idempotent on an already-pending task', async () => {
    const tasks = createInMemoryTaskRepository();
    const clock = createFixedClock(new Date('2026-05-04T13:00:00Z'));
    const t0 = Task.create({
      id: id(VALID_ID),
      title: title('x'),
      now: new Date('2026-05-04T10:00:00Z'),
    });
    tasks.seed(t0);

    const r = await reopenTask({ id: VALID_ID }, { tasks, clock });

    assert.equal(r.ok, true);
    if (!r.ok) return;
    assert.equal(r.value.status, 'pending');
    assert.equal(r.value.updatedAt.toISOString(), '2026-05-04T10:00:00.000Z');
    assert.equal(tasks.saveCalls.length, 0);
  });

  it('returns TaskNotFound when the task does not exist', async () => {
    const tasks = createInMemoryTaskRepository();
    const clock = createFixedClock(new Date('2026-05-04T13:00:00Z'));

    const r = await reopenTask({ id: VALID_ID }, { tasks, clock });

    assert.equal(r.ok, false);
    if (r.ok) return;
    assert.equal(r.error.kind, 'TaskNotFound');
  });

  it('returns ValidationError for an invalid id', async () => {
    const tasks = createInMemoryTaskRepository();
    const clock = createFixedClock(new Date('2026-05-04T13:00:00Z'));

    const r = await reopenTask({ id: 'nope' }, { tasks, clock });

    assert.equal(r.ok, false);
    if (r.ok) return;
    assert.equal(r.error.kind, 'ValidationError');
  });
});
