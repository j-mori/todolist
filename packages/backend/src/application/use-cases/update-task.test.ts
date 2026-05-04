import { strict as assert } from 'node:assert';
import { describe, it } from 'node:test';
import { TASK_IDS, taskOf } from '../../domain/task/task.test-support.ts';
import { createFixedClock } from '../test-support/fixed-clock.test-support.ts';
import { createInMemoryTaskRepository } from '../test-support/in-memory-task-repository.test-support.ts';
import { updateTask } from './update-task.ts';

const VALID_ID = TASK_IDS.X;

const seed = () => {
  const tasks = createInMemoryTaskRepository();
  const clock = createFixedClock(new Date('2026-05-04T11:00:00Z'));
  const existing = taskOf({ id: VALID_ID, title: 'Buy milk', now: '2026-05-04T10:00:00Z' });
  tasks.seed(existing);
  return { tasks, clock, existing };
};

describe('updateTask', () => {
  it('changes the title and advances updatedAt', async () => {
    const { tasks, clock } = seed();
    const r = await updateTask({ id: VALID_ID, title: 'Buy oat milk' }, { tasks, clock });

    assert.equal(r.ok, true);
    if (!r.ok) return;
    assert.equal(r.value.title, 'Buy oat milk');
    assert.equal(r.value.updatedAt.toISOString(), '2026-05-04T11:00:00.000Z');
    assert.equal(tasks.saveCalls.length, 1);
  });

  it('returns TaskNotFound when the task does not exist; repo not written', async () => {
    const { clock } = seed();
    const empty = createInMemoryTaskRepository();
    const r = await updateTask(
      { id: TASK_IDS.UNKNOWN, title: 'whatever' },
      { tasks: empty, clock },
    );

    assert.equal(r.ok, false);
    if (r.ok) return;
    assert.equal(r.error.kind, 'TaskNotFound');
    assert.equal(empty.saveCalls.length, 0);
  });

  it('returns ValidationError for an invalid id; repo not read or written', async () => {
    const { tasks, clock } = seed();
    const r = await updateTask({ id: 'not-a-uuid', title: 'whatever' }, { tasks, clock });

    assert.equal(r.ok, false);
    if (r.ok) return;
    assert.equal(r.error.kind, 'ValidationError');
    assert.equal(r.error.field, 'id');
    assert.equal(tasks.saveCalls.length, 0);
  });

  it('returns ValidationError for an invalid title; repo not written', async () => {
    const { tasks, clock } = seed();
    const r = await updateTask({ id: VALID_ID, title: '' }, { tasks, clock });

    assert.equal(r.ok, false);
    if (r.ok) return;
    assert.equal(r.error.kind, 'ValidationError');
    assert.equal(r.error.field, 'title');
    assert.equal(tasks.saveCalls.length, 0);
  });

  it('is idempotent when the new title equals the current one: returns ok, repo save not called', async () => {
    const { tasks, clock, existing } = seed();
    const r = await updateTask({ id: VALID_ID, title: 'Buy milk' }, { tasks, clock });

    assert.equal(r.ok, true);
    if (!r.ok) return;
    assert.equal(r.value.title, existing.title);
    assert.equal(r.value.updatedAt.toISOString(), existing.updatedAt.toISOString());
    assert.equal(tasks.saveCalls.length, 0);
  });
});
