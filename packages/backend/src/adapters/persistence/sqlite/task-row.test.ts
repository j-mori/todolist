import { strict as assert } from 'node:assert';
import { describe, it } from 'node:test';
import { TASK_IDS, taskOf } from '../../../domain/task/task.test-support.ts';
import { rowToTask, taskToRow } from './task-row.ts';

describe('task-row mapping', () => {
  it('taskToRow then rowToTask is identity for a pending task', () => {
    const original = taskOf({ id: TASK_IDS.A, title: 'Buy milk', now: '2026-05-04T10:00:00.123Z' });
    const round = rowToTask(taskToRow(original));

    assert.equal(round.id, original.id);
    assert.equal(round.title, original.title);
    assert.equal(round.status, original.status);
    assert.equal(round.createdAt.toISOString(), original.createdAt.toISOString());
    assert.equal(round.updatedAt.toISOString(), original.updatedAt.toISOString());
  });

  it('taskToRow then rowToTask is identity for a completed task', () => {
    const original = taskOf({
      id: TASK_IDS.B,
      title: 'Done',
      now: '2026-05-04T10:00:00Z',
      status: 'completed',
    });
    const round = rowToTask(taskToRow(original));

    assert.equal(round.status, 'completed');
    assert.equal(round.title, 'Done');
  });

  it('taskToRow serialises timestamps to ISO 8601 with millisecond precision', () => {
    const t = taskOf({ id: TASK_IDS.C, title: 'x', now: '2026-05-04T10:00:00.045Z' });
    const row = taskToRow(t);

    assert.equal(row.created_at, '2026-05-04T10:00:00.045Z');
    assert.equal(row.updated_at, '2026-05-04T10:00:00.045Z');
  });

  it('rowToTask produces a Task whose transitions still work (proves restore-built tasks are first-class)', () => {
    const row = taskToRow(taskOf({ id: TASK_IDS.X, title: 'x', now: '2026-05-04T10:00:00Z' }));
    const restored = rowToTask(row);
    const completed = restored.complete(new Date('2026-05-04T11:00:00Z'));

    assert.equal(completed.status, 'completed');
    assert.equal(completed.updatedAt.toISOString(), '2026-05-04T11:00:00.000Z');
  });
});
