import type { Context } from 'hono';
import type { ZodType } from 'zod';
import { taskIdParamSchema } from '@todolist/shared';
import { err, ok, type Result } from '../../domain/shared/result.ts';
import { validationError, type ValidationError } from '../../domain/task/errors.ts';

const fieldOf = (path: ReadonlyArray<PropertyKey>, fallback: string): string =>
  path.length === 0 ? fallback : path.map(String).join('.');

/** Validate the `:id` path param as a UUID v4. */
export const parseIdParam = (c: Context): Result<string, ValidationError> => {
  const parsed = taskIdParamSchema.safeParse({ id: c.req.param('id') });
  if (!parsed.success) {
    return err(validationError('id', 'must be a UUID v4'));
  }
  return ok(parsed.data.id);
};

/**
 * Read the request body as JSON and validate it against `schema`.
 *
 * Maps two distinct failures onto `ValidationError`:
 * - body that isn't well-formed JSON → `field: 'body'`, reason describes the parse failure
 * - JSON that doesn't match the schema → `field: <zod path>`, reason from the Zod issue
 */
export const parseJsonBody = async <T>(
  c: Context,
  schema: ZodType<T>,
): Promise<Result<T, ValidationError>> => {
  let raw: unknown;
  try {
    raw = await c.req.json();
  } catch (e) {
    const reason = e instanceof Error ? e.message : 'malformed JSON';
    return err(validationError('body', reason));
  }
  const parsed = schema.safeParse(raw);
  if (!parsed.success) {
    const issue = parsed.error.issues[0];
    if (!issue) return err(validationError('body', 'invalid request'));
    return err(validationError(fieldOf(issue.path, 'body'), issue.message));
  }
  return ok(parsed.data);
};
