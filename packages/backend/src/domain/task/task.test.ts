import { strict as assert } from 'node:assert';
import { describe, it } from 'node:test';
import { TaskId } from './task-id.ts';
import { TaskTitle } from './task-title.ts';
import { Task } from './task.ts';

const ID = '550e8400-e29b-41d4-a716-446655440000';
const idOf = (s: string) => {
  const r = TaskId.from(s);
  if (!r.ok) throw new Error('test fixture id invalid');
  return r.value;
};
const titleOf = (s: string) => {
  const r = TaskTitle.from(s);
  if (!r.ok) throw new Error('test fixture title invalid');
  return r.value;
};

describe('Task', () => {
  it('create produces a pending task with the supplied id, title, and timestamps', () => {
    const now = new Date('2026-05-04T10:00:00Z');
    const t = Task.create({ id: idOf(ID), title: titleOf('Buy milk'), now });
    assert.equal(t.id, ID);
    assert.equal(t.title, 'Buy milk');
    assert.equal(t.status, 'pending');
    assert.equal(t.createdAt.toISOString(), '2026-05-04T10:00:00.000Z');
    assert.equal(t.updatedAt.toISOString(), '2026-05-04T10:00:00.000Z');
  });

  it('withTitle returns a new instance with the new title and an advanced updatedAt; createdAt unchanged', () => {
    const created = new Date('2026-05-04T10:00:00Z');
    const updated = new Date('2026-05-04T11:00:00Z');
    const original = Task.create({ id: idOf(ID), title: titleOf('Buy milk'), now: created });
    const next = original.withTitle(titleOf('Buy oat milk'), updated);

    assert.notEqual(next, original);
    assert.equal(next.title, 'Buy oat milk');
    assert.equal(next.createdAt.toISOString(), '2026-05-04T10:00:00.000Z');
    assert.equal(next.updatedAt.toISOString(), '2026-05-04T11:00:00.000Z');
    assert.equal(original.title, 'Buy milk');
  });

  it('complete on a pending task returns a completed task with advanced updatedAt', () => {
    const created = new Date('2026-05-04T10:00:00Z');
    const completedAt = new Date('2026-05-04T12:00:00Z');
    const original = Task.create({ id: idOf(ID), title: titleOf('Buy milk'), now: created });
    const next = original.complete(completedAt);

    assert.notEqual(next, original);
    assert.equal(next.status, 'completed');
    assert.equal(next.updatedAt.toISOString(), '2026-05-04T12:00:00.000Z');
  });

  it('complete on an already-completed task is idempotent (same instance, updatedAt unchanged)', () => {
    const t0 = Task.create({ id: idOf(ID), title: titleOf('x'), now: new Date('2026-05-04T10:00:00Z') });
    const completed = t0.complete(new Date('2026-05-04T11:00:00Z'));
    const again = completed.complete(new Date('2026-05-04T12:00:00Z'));

    assert.equal(again, completed);
    assert.equal(again.updatedAt.toISOString(), '2026-05-04T11:00:00.000Z');
  });

  it('reopen on a completed task returns a pending task with advanced updatedAt', () => {
    const t0 = Task.create({ id: idOf(ID), title: titleOf('x'), now: new Date('2026-05-04T10:00:00Z') });
    const completed = t0.complete(new Date('2026-05-04T11:00:00Z'));
    const reopened = completed.reopen(new Date('2026-05-04T12:00:00Z'));

    assert.notEqual(reopened, completed);
    assert.equal(reopened.status, 'pending');
    assert.equal(reopened.updatedAt.toISOString(), '2026-05-04T12:00:00.000Z');
  });

  it('reopen on an already-pending task is idempotent (same instance, updatedAt unchanged)', () => {
    const t0 = Task.create({ id: idOf(ID), title: titleOf('x'), now: new Date('2026-05-04T10:00:00Z') });
    const again = t0.reopen(new Date('2026-05-04T12:00:00Z'));

    assert.equal(again, t0);
    assert.equal(again.updatedAt.toISOString(), '2026-05-04T10:00:00.000Z');
  });
});
