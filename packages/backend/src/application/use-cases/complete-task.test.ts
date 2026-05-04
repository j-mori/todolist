import { strict as assert } from 'node:assert';
import { describe, it } from 'node:test';
import { TASK_IDS, taskOf } from '../../domain/task/task.test-support.ts';
import { createFixedClock } from '../test-support/fixed-clock.test-support.ts';
import { createInMemoryTaskRepository } from '../test-support/in-memory-task-repository.test-support.ts';
import { completeTask } from './complete-task.ts';

const VALID_ID = TASK_IDS.X;

describe('completeTask', () => {
  it('marks a pending task as completed and saves it', async () => {
    const tasks = createInMemoryTaskRepository();
    const clock = createFixedClock(new Date('2026-05-04T11:00:00Z'));
    tasks.seed(taskOf({ id: VALID_ID, title: 'x', now: '2026-05-04T10:00:00Z' }));

    const r = await completeTask({ id: VALID_ID }, { tasks, clock });

    assert.equal(r.ok, true);
    if (!r.ok) return;
    assert.equal(r.value.status, 'completed');
    assert.equal(r.value.updatedAt.toISOString(), '2026-05-04T11:00:00.000Z');
    assert.equal(tasks.saveCalls.length, 1);
  });

  it('is idempotent on an already-completed task: returns ok and does not write to the repo', async () => {
    const tasks = createInMemoryTaskRepository();
    const clock = createFixedClock(new Date('2026-05-04T12:00:00Z'));
    const t0 = taskOf({ id: VALID_ID, title: 'x', now: '2026-05-04T10:00:00Z' });
    tasks.seed(t0.complete(new Date('2026-05-04T11:00:00Z')));

    const r = await completeTask({ id: VALID_ID }, { tasks, clock });

    assert.equal(r.ok, true);
    if (!r.ok) return;
    assert.equal(r.value.status, 'completed');
    assert.equal(r.value.updatedAt.toISOString(), '2026-05-04T11:00:00.000Z');
    assert.equal(tasks.saveCalls.length, 0);
  });

  it('returns TaskNotFound when the task does not exist', async () => {
    const tasks = createInMemoryTaskRepository();
    const clock = createFixedClock(new Date('2026-05-04T11:00:00Z'));

    const r = await completeTask({ id: VALID_ID }, { tasks, clock });

    assert.equal(r.ok, false);
    if (r.ok) return;
    assert.equal(r.error.kind, 'TaskNotFound');
    assert.equal(tasks.saveCalls.length, 0);
  });

  it('returns ValidationError for an invalid id', async () => {
    const tasks = createInMemoryTaskRepository();
    const clock = createFixedClock(new Date('2026-05-04T11:00:00Z'));

    const r = await completeTask({ id: 'nope' }, { tasks, clock });

    assert.equal(r.ok, false);
    if (r.ok) return;
    assert.equal(r.error.kind, 'ValidationError');
    assert.equal(r.error.field, 'id');
  });
});
