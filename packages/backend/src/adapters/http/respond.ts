import type { Context } from 'hono';
import type { ApiError, ErrorResponse } from '@todolist/shared';
import type { Result } from '../../domain/shared/result.ts';
import type { DomainError, ValidationError } from '../../domain/task/errors.ts';
import type { Task } from '../../domain/task/task.ts';
import { taskToWire } from './wire.ts';

const errorToBody = (error: DomainError): ErrorResponse => {
  const apiError: ApiError =
    error.kind === 'ValidationError'
      ? { kind: 'ValidationError', field: error.field, reason: error.reason }
      : { kind: 'TaskNotFound', id: error.id };
  return { error: apiError };
};

const respondError = (c: Context, error: DomainError): Response => {
  const status = error.kind === 'ValidationError' ? 400 : 404;
  return c.json(errorToBody(error), status);
};

export const respondOk = (c: Context, result: Result<Task, DomainError>): Response =>
  result.ok ? c.json(taskToWire(result.value), 200) : respondError(c, result.error);

export const respondCreated = (c: Context, result: Result<Task, DomainError>): Response =>
  result.ok ? c.json(taskToWire(result.value), 201) : respondError(c, result.error);

export const respondNoContent = (c: Context, result: Result<void, DomainError>): Response =>
  result.ok ? c.body(null, 204) : respondError(c, result.error);

export const respondValidationError = (c: Context, error: ValidationError): Response =>
  c.json(errorToBody(error), 400);
