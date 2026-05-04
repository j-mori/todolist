import { err, ok, type Result } from '../../domain/shared/result.ts';
import type { ValidationError } from '../../domain/task/errors.ts';
import { Task } from '../../domain/task/task.ts';
import { TaskTitle } from '../../domain/task/task-title.ts';
import type { Clock } from '../ports/clock.ts';
import type { IdGenerator } from '../ports/id-generator.ts';
import type { TaskRepository } from '../ports/task-repository.ts';

export type AddTaskInput = { title: string };
export type AddTaskDeps = { tasks: TaskRepository; clock: Clock; ids: IdGenerator };
export type AddTaskError = ValidationError;

export const addTask = async (
  input: AddTaskInput,
  deps: AddTaskDeps,
): Promise<Result<Task, AddTaskError>> => {
  const title = TaskTitle.from(input.title);
  if (!title.ok) return err(title.error);

  const task = Task.create({
    id: deps.ids.next(),
    title: title.value,
    now: deps.clock.now(),
  });
  await deps.tasks.save(task);
  return ok(task);
};
