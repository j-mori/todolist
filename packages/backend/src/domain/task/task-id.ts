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

const unsafe = (input: string): TaskId => input as TaskId;

export const TaskId = { from, unsafe };
