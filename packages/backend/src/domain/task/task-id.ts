import { z } from 'zod';
import { err, ok, type Result } from '../shared/result.ts';
import { validationError, type ValidationError } from './errors.ts';

declare const taskIdBrand: unique symbol;
export type TaskId = string & { readonly [taskIdBrand]: never };

const schema = z.uuid({ version: 'v4' });

const from = (input: string): Result<TaskId, ValidationError> => {
  const parsed = schema.safeParse(input);
  if (!parsed.success) {
    return err(validationError('id', 'must be a UUID v4'));
  }
  return ok(parsed.data as TaskId);
};

export const TaskId = { from };

/**
 * Internal: brand a string as a {@link TaskId} without revalidating.
 *
 * Reserved for `Task.restore` (persistence read path) and the production
 * `IdGenerator` (which sources from `crypto.randomUUID()`, already a UUID v4
 * by construction). Not exported from the package.
 */
export const __unsafeTaskId = (input: string): TaskId => input as TaskId;
