import type { Context } from 'hono';
import type { ContentfulStatusCode, StatusCode } from 'hono/utils/http-status';
import type { ApiError, Task as ApiTask, ErrorResponse } from '@todolist/shared';
import type { Result } from '../../domain/shared/result.ts';
import type { DomainError } from '../../domain/task/errors.ts';
import type { Task } from '../../domain/task/task.ts';

export const taskToWire = (task: Task): ApiTask => ({
  id: task.id,
  title: task.title,
  status: task.status,
  createdAt: task.createdAt.toISOString(),
  updatedAt: task.updatedAt.toISOString(),
});

const errorToBody = (error: DomainError): ErrorResponse => {
  const apiError: ApiError =
    error.kind === 'ValidationError'
      ? { kind: 'ValidationError', field: error.field, reason: error.reason }
      : { kind: 'TaskNotFound', id: error.id };
  return { error: apiError };
};

const statusFor = (error: DomainError): ContentfulStatusCode =>
  error.kind === 'ValidationError' ? 400 : 404;

export const respondWithTask = (
  c: Context,
  result: Result<Task, DomainError>,
  successStatus: ContentfulStatusCode = 200,
): Response => {
  if (result.ok) {
    return c.json(taskToWire(result.value), successStatus);
  }
  return c.json(errorToBody(result.error), statusFor(result.error));
};

export const respondWithVoid = (
  c: Context,
  result: Result<void, DomainError>,
  successStatus: StatusCode = 204,
): Response => {
  if (result.ok) {
    return c.body(null, successStatus);
  }
  return c.json(errorToBody(result.error), statusFor(result.error));
};

export const respondWithValidationError = (
  c: Context,
  field: string,
  reason: string,
): Response => {
  const body: ErrorResponse = { error: { kind: 'ValidationError', field, reason } };
  return c.json(body, 400);
};
