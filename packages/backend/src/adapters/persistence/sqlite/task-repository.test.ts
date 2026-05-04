import { strict as assert } from 'node:assert';
import { afterEach, beforeEach, describe, it } from 'node:test';
import type { TaskRepository } from '../../../application/ports/task-repository.ts';
import { idOf, TASK_IDS, taskOf, titleOf } from '../../../domain/task/task.test-support.ts';
import { type DatabaseHandle, openDatabase } from './db.ts';
import { initSchema } from './schema.ts';
import { createSqliteTaskRepository } from './task-repository.ts';

const ID_A = TASK_IDS.A;
const ID_B = TASK_IDS.B;

describe('createSqliteTaskRepository', () => {
  let handle: DatabaseHandle;
  let repo: TaskRepository;

  beforeEach(async () => {
    handle = openDatabase({ path: ':memory:' });
    await initSchema(handle.kysely);
    repo = createSqliteTaskRepository(handle.kysely);
  });

  afterEach(async () => {
    await handle.kysely.destroy();
  });

  it('save then findById round-trips a task with timestamps preserved at millisecond precision', async () => {
    const t = taskOf({ id: ID_A, title: 'Buy milk', now: '2026-05-04T10:00:00.123Z' });
    await repo.save(t);

    const found = await repo.findById(idOf(ID_A));
    if (found === null) {
      assert.fail('expected task to be found');
    }
    assert.equal(found.id, ID_A);
    assert.equal(found.title, 'Buy milk');
    assert.equal(found.status, 'pending');
    assert.equal(found.createdAt.toISOString(), '2026-05-04T10:00:00.123Z');
    assert.equal(found.updatedAt.toISOString(), '2026-05-04T10:00:00.123Z');
  });

  it('findById returns null for an unknown id', async () => {
    const found = await repo.findById(idOf(ID_A));
    assert.equal(found, null);
  });

  it('save upserts: a second save with the same id replaces title/status/updated_at', async () => {
    const t0 = taskOf({ id: ID_A, title: 'first', now: '2026-05-04T10:00:00Z' });
    await repo.save(t0);

    const t1 = t0.withTitle(titleOf('second'), new Date('2026-05-04T11:00:00Z')).complete(new Date('2026-05-04T11:00:00Z'));
    await repo.save(t1);

    const found = await repo.findById(idOf(ID_A));
    if (found === null) {
      assert.fail('expected task to be found');
    }
    assert.equal(found.title, 'second');
    assert.equal(found.status, 'completed');
    assert.equal(found.updatedAt.toISOString(), '2026-05-04T11:00:00.000Z');
  });

  it('list returns all rows in createdAt desc order', async () => {
    await repo.save(taskOf({ id: ID_A, title: 'older', now: '2026-05-01T00:00:00Z' }));
    await repo.save(taskOf({ id: ID_B, title: 'newer', now: '2026-05-02T00:00:00Z' }));

    const all = await repo.list();
    assert.deepEqual(
      all.map((t) => t.title),
      ['newer', 'older'],
    );
  });

  it('delete removes an existing task; subsequent findById returns null', async () => {
    await repo.save(taskOf({ id: ID_A, title: 'x', now: '2026-05-04T10:00:00Z' }));
    await repo.delete(idOf(ID_A));
    const found = await repo.findById(idOf(ID_A));
    assert.equal(found, null);
  });

  it('delete on an unknown id is a no-op (no throw, no row count change)', async () => {
    await repo.save(taskOf({ id: ID_A, title: 'survivor', now: '2026-05-04T10:00:00Z' }));
    await repo.delete(idOf(ID_B));
    const all = await repo.list();
    assert.equal(all.length, 1);
  });
});
