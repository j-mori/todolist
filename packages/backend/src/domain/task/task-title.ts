import { TASK_TITLE_MAX_LENGTH, TASK_TITLE_MIN_LENGTH } from '@todolist/shared';
import { err, ok, type Result } from '../shared/result.ts';
import { validationError, type ValidationError } from './errors.ts';

declare const taskTitleBrand: unique symbol;
export type TaskTitle = string & { readonly [taskTitleBrand]: never };

const from = (input: string): Result<TaskTitle, ValidationError> => {
  const trimmed = input.trim();
  if (trimmed.length < TASK_TITLE_MIN_LENGTH) {
    return err(validationError('title', 'must not be empty'));
  }
  if (trimmed.length > TASK_TITLE_MAX_LENGTH) {
    return err(validationError('title', `must be at most ${TASK_TITLE_MAX_LENGTH} characters`));
  }
  return ok(trimmed as TaskTitle);
};

export const TaskTitle = { from };

/**
 * Internal: brand a string as a {@link TaskTitle} without revalidating.
 *
 * Reserved for the persistence boundary, which reads rows that were validated
 * on the way in. Not exported from the package — `Task.restore` is the only
 * public consumer.
 */
export const __unsafeTaskTitle = (input: string): TaskTitle => input as TaskTitle;
