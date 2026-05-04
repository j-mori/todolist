import { err, ok, type Result } from '../shared/result.ts';
import { validationError, type ValidationError } from './errors.ts';

declare const taskTitleBrand: unique symbol;
export type TaskTitle = string & { readonly [taskTitleBrand]: never };

export const TASK_TITLE_MAX_LENGTH = 200;

const from = (input: string): Result<TaskTitle, ValidationError> => {
  const trimmed = input.trim();
  if (trimmed.length === 0) {
    return err(validationError('title', 'must not be empty'));
  }
  if (trimmed.length > TASK_TITLE_MAX_LENGTH) {
    return err(validationError('title', `must be at most ${TASK_TITLE_MAX_LENGTH} characters`));
  }
  return ok(trimmed as TaskTitle);
};

const unsafe = (input: string): TaskTitle => input as TaskTitle;

export const TaskTitle = { from, unsafe };
