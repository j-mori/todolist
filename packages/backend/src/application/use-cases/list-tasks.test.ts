import { strict as assert } from 'node:assert';
import { describe, it } from 'node:test';
import { TASK_IDS, taskOf } from '../../domain/task/task.test-support.ts';
import { createInMemoryTaskRepository } from '../test-support/in-memory-task-repository.test-support.ts';
import { listTasks } from './list-tasks.ts';

describe('listTasks', () => {
  it('returns an empty array when there are no tasks', async () => {
    const tasks = createInMemoryTaskRepository();
    const result = await listTasks({ tasks });
    assert.deepEqual(result, []);
  });

  it('returns tasks in createdAt-descending order regardless of insertion order', async () => {
    const tasks = createInMemoryTaskRepository();
    const oldest = taskOf({ id: TASK_IDS.A, title: 'oldest', now: '2026-05-01T00:00:00Z' });
    const middle = taskOf({ id: TASK_IDS.B, title: 'middle', now: '2026-05-02T00:00:00Z' });
    const newest = taskOf({ id: TASK_IDS.C, title: 'newest', now: '2026-05-03T00:00:00Z' });

    tasks.seed(middle, oldest, newest);

    const result = await listTasks({ tasks });
    assert.deepEqual(
      result.map((t) => t.title),
      ['newest', 'middle', 'oldest'],
    );
  });
});
