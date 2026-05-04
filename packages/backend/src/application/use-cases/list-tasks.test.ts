import { strict as assert } from 'node:assert';
import { describe, it } from 'node:test';
import { Task } from '../../domain/task/task.ts';
import { TaskId } from '../../domain/task/task-id.ts';
import { TaskTitle } from '../../domain/task/task-title.ts';
import { createInMemoryTaskRepository } from '../test-support/in-memory-task-repository.test-support.ts';
import { listTasks } from './list-tasks.ts';

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

describe('listTasks', () => {
  it('returns an empty array when there are no tasks', async () => {
    const tasks = createInMemoryTaskRepository();
    const result = await listTasks({ tasks });
    assert.deepEqual(result, []);
  });

  it('returns tasks sorted by createdAt descending regardless of repo insertion order', async () => {
    const tasks = createInMemoryTaskRepository();
    const oldest = Task.create({
      id: id('11111111-1111-4111-8111-111111111111'),
      title: title('oldest'),
      now: new Date('2026-05-01T00:00:00Z'),
    });
    const middle = Task.create({
      id: id('22222222-2222-4222-8222-222222222222'),
      title: title('middle'),
      now: new Date('2026-05-02T00:00:00Z'),
    });
    const newest = Task.create({
      id: id('33333333-3333-4333-8333-333333333333'),
      title: title('newest'),
      now: new Date('2026-05-03T00:00:00Z'),
    });

    tasks.seed(middle, oldest, newest);

    const result = await listTasks({ tasks });
    assert.deepEqual(
      result.map((t) => t.title),
      ['newest', 'middle', 'oldest'],
    );
  });
});
