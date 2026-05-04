import type { TaskId } from '../../domain/task/task-id.ts';

export type IdGenerator = {
  next(): TaskId;
};
