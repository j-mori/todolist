import { TaskId } from '../../domain/task/task-id.ts';
import type { IdGenerator } from '../ports/id-generator.ts';

export type SequentialIdGenerator = IdGenerator & {
  readonly issued: TaskId[];
};

export const createSequentialIdGenerator = (): SequentialIdGenerator => {
  const issued: TaskId[] = [];
  let counter = 0;

  return {
    issued,
    next() {
      counter++;
      const suffix = counter.toString(16).padStart(12, '0');
      const id = TaskId.unsafe(`00000000-0000-4000-8000-${suffix}`);
      issued.push(id);
      return id;
    },
  };
};
