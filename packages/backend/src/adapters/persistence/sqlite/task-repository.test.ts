import { strict as assert } from 'node:assert';
import { afterEach, beforeEach, describe, it } from 'node:test';
import { Task } from '../../../domain/task/task.ts';
import { TaskId } from '../../../domain/task/task-id.ts';
import { TaskTitle } from '../../../domain/task/task-title.ts';
import type { TaskRepository } from '../../../application/ports/task-repository.ts';
import { type DatabaseHandle, openDatabase } from './db.ts';
import { initSchema } from './schema.ts';
import { createSqliteTaskRepository } from './task-repository.ts';

const idOf = (s: string) => {
  const r = TaskId.from(s);
  if (!r.ok) throw new Error('bad id');
  return r.value;
};
const titleOf = (s: string) => {
  const r = TaskTitle.from(s);
  if (!r.ok) throw new Error('bad title');
  return r.value;
};
const taskOf = (id: string, title: string, now: string) =>
  Task.create({ id: idOf(id), title: titleOf(title), now: new Date(now) });

const ID_A = '11111111-1111-4111-8111-111111111111';
const ID_B = '22222222-2222-4222-8222-222222222222';

describe('createSqliteTaskRepository', () => {
  let handle: DatabaseHandle;
  let repo: TaskRepository;

  beforeEach(async () => {
    handle = openDatabase(':memory:');
    await initSchema(handle.kysely);
    repo = createSqliteTaskRepository(handle.kysely);
  });

  afterEach(async () => {
    await handle.kysely.destroy();
  });

  it('save then findById round-trips a task with timestamps preserved at millisecond precision', async () => {
    const t = taskOf(ID_A, 'Buy milk', '2026-05-04T10:00:00.123Z');
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
    const t0 = taskOf(ID_A, 'first', '2026-05-04T10:00:00Z');
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
    await repo.save(taskOf(ID_A, 'older', '2026-05-01T00:00:00Z'));
    await repo.save(taskOf(ID_B, 'newer', '2026-05-02T00:00:00Z'));

    const all = await repo.list();
    assert.deepEqual(
      all.map((t) => t.title),
      ['newer', 'older'],
    );
  });

  it('delete removes an existing task; subsequent findById returns null', async () => {
    await repo.save(taskOf(ID_A, 'x', '2026-05-04T10:00:00Z'));
    await repo.delete(idOf(ID_A));
    const found = await repo.findById(idOf(ID_A));
    assert.equal(found, null);
  });

  it('delete on an unknown id is a no-op (no throw, no row count change)', async () => {
    await repo.save(taskOf(ID_A, 'survivor', '2026-05-04T10:00:00Z'));
    await repo.delete(idOf(ID_B));
    const all = await repo.list();
    assert.equal(all.length, 1);
  });
});
