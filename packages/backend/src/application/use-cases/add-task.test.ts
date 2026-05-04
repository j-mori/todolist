import { strict as assert } from 'node:assert';
import { describe, it } from 'node:test';
import { createFixedClock } from '../test-support/fixed-clock.test-support.ts';
import { createInMemoryTaskRepository } from '../test-support/in-memory-task-repository.test-support.ts';
import { createSequentialIdGenerator } from '../test-support/sequential-id-generator.test-support.ts';
import { addTask } from './add-task.ts';

const setup = () => ({
  tasks: createInMemoryTaskRepository(),
  clock: createFixedClock(new Date('2026-05-04T10:00:00Z')),
  ids: createSequentialIdGenerator(),
});

describe('addTask', () => {
  it('persists a new pending task with the issued id and clock-stamped timestamps', async () => {
    const deps = setup();
    const r = await addTask({ title: 'Buy milk' }, deps);

    assert.equal(r.ok, true);
    if (!r.ok) return;
    assert.equal(r.value.title, 'Buy milk');
    assert.equal(r.value.status, 'pending');
    assert.equal(r.value.id, deps.ids.issued[0]);
    assert.equal(r.value.createdAt.toISOString(), '2026-05-04T10:00:00.000Z');
    assert.equal(deps.tasks.saveCalls.length, 1);
    assert.equal(deps.tasks.saveCalls[0]?.id, r.value.id);
    assert.equal(deps.ids.issued.length, 1);
  });

  it('trims the title before persisting', async () => {
    const deps = setup();
    const r = await addTask({ title: '   Tidy desk   ' }, deps);

    assert.equal(r.ok && r.value.title === 'Tidy desk', true);
  });

  it('returns ValidationError for an empty title and does not touch the repo or id generator', async () => {
    const deps = setup();
    const r = await addTask({ title: '   ' }, deps);

    assert.equal(r.ok, false);
    if (r.ok) return;
    assert.equal(r.error.kind, 'ValidationError');
    assert.equal(r.error.field, 'title');
    assert.equal(deps.tasks.saveCalls.length, 0);
    assert.equal(deps.ids.issued.length, 0);
  });
});
