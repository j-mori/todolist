import { strict as assert } from 'node:assert';
import { describe, it } from 'node:test';
import { TASK_IDS, taskOf } from '../../domain/task/task.test-support.ts';
import { createFixedClock } from '../test-support/fixed-clock.test-support.ts';
import { createInMemoryTaskRepository } from '../test-support/in-memory-task-repository.test-support.ts';
import { reopenTask } from './reopen-task.ts';

const VALID_ID = TASK_IDS.X;

describe('reopenTask', () => {
  it('marks a completed task as pending and saves it', async () => {
    const tasks = createInMemoryTaskRepository();
    const clock = createFixedClock(new Date('2026-05-04T13:00:00Z'));
    const t0 = taskOf({ id: VALID_ID, title: 'x', now: '2026-05-04T10:00:00Z' });
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
    const t0 = taskOf({ id: VALID_ID, title: 'x', now: '2026-05-04T10:00:00Z' });
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
