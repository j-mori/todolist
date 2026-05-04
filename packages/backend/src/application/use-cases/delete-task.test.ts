import { strict as assert } from 'node:assert';
import { describe, it } from 'node:test';
import { Task } from '../../domain/task/task.ts';
import { TaskId } from '../../domain/task/task-id.ts';
import { TaskTitle } from '../../domain/task/task-title.ts';
import { createInMemoryTaskRepository } from '../test-support/in-memory-task-repository.test-support.ts';
import { deleteTask } from './delete-task.ts';

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

describe('deleteTask', () => {
  it('removes an existing task', async () => {
    const tasks = createInMemoryTaskRepository();
    tasks.seed(
      Task.create({
        id: id(VALID_ID),
        title: title('x'),
        now: new Date('2026-05-04T10:00:00Z'),
      }),
    );

    const r = await deleteTask({ id: VALID_ID }, { tasks });

    assert.equal(r.ok, true);
    assert.equal(tasks.deleteCalls.length, 1);
    assert.equal(tasks.contents().length, 0);
  });

  it('returns TaskNotFound when the task does not exist; repo delete not called', async () => {
    const tasks = createInMemoryTaskRepository();

    const r = await deleteTask({ id: VALID_ID }, { tasks });

    assert.equal(r.ok, false);
    if (r.ok) return;
    assert.equal(r.error.kind, 'TaskNotFound');
    assert.equal(tasks.deleteCalls.length, 0);
  });

  it('returns ValidationError for an invalid id', async () => {
    const tasks = createInMemoryTaskRepository();

    const r = await deleteTask({ id: 'nope' }, { tasks });

    assert.equal(r.ok, false);
    if (r.ok) return;
    assert.equal(r.error.kind, 'ValidationError');
    assert.equal(tasks.deleteCalls.length, 0);
  });
});
