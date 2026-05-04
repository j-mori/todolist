import { strict as assert } from 'node:assert';
import { describe, it } from 'node:test';
import { Task } from './task.ts';
import { idOf, TASK_IDS, titleOf } from './task.test-support.ts';

const ID = TASK_IDS.X;

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

  it('withTitle is idempotent when the new title equals the current one (same instance, updatedAt unchanged)', () => {
    const t0 = Task.create({ id: idOf(ID), title: titleOf('Buy milk'), now: new Date('2026-05-04T10:00:00Z') });
    const sameTitle = titleOf('Buy milk');
    const again = t0.withTitle(sameTitle, new Date('2026-05-04T11:00:00Z'));

    assert.equal(again, t0);
    assert.equal(again.updatedAt.toISOString(), '2026-05-04T10:00:00.000Z');
  });

  it('restore reconstructs a Task with all fields preserved without revalidation', () => {
    const restored = Task.restore({
      id: ID,
      title: 'persisted',
      status: 'completed',
      createdAt: new Date('2026-05-01T08:00:00Z'),
      updatedAt: new Date('2026-05-04T09:30:00Z'),
    });

    assert.equal(restored.id, ID);
    assert.equal(restored.title, 'persisted');
    assert.equal(restored.status, 'completed');
    assert.equal(restored.createdAt.toISOString(), '2026-05-01T08:00:00.000Z');
    assert.equal(restored.updatedAt.toISOString(), '2026-05-04T09:30:00.000Z');
  });

  it('restore yields a Task whose behaviour is indistinguishable from one built via create', () => {
    const restored = Task.restore({
      id: ID,
      title: 'x',
      status: 'pending',
      createdAt: new Date('2026-05-01T00:00:00Z'),
      updatedAt: new Date('2026-05-01T00:00:00Z'),
    });
    const completed = restored.complete(new Date('2026-05-04T12:00:00Z'));
    assert.equal(completed.status, 'completed');
    assert.equal(completed.updatedAt.toISOString(), '2026-05-04T12:00:00.000Z');
  });
});
