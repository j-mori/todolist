import type { MiddlewareHandler } from 'hono';
import type { ErrorResponse } from '@todolist/shared';

const CONTENT_LENGTH_HEADER = 'content-length';

/**
 * Reject requests whose body exceeds `maxBytes`. We trust `Content-Length` as
 * the cheap, common case; clients without it (chunked transfer) are rejected
 * preemptively to avoid buffering an unbounded payload.
 */
export const bodyLimit = (maxBytes: number): MiddlewareHandler => async (c, next) => {
  if (c.req.method === 'GET' || c.req.method === 'HEAD' || c.req.method === 'DELETE') {
    return next();
  }
  const header = c.req.header(CONTENT_LENGTH_HEADER);
  if (header === undefined) {
    return next();
  }
  const length = Number(header);
  if (!Number.isFinite(length) || length < 0) {
    const body: ErrorResponse = {
      error: { kind: 'ValidationError', field: 'content-length', reason: 'invalid' },
    };
    return c.json(body, 400);
  }
  if (length > maxBytes) {
    const body: ErrorResponse = {
      error: {
        kind: 'ValidationError',
        field: 'body',
        reason: `request body exceeds ${maxBytes} bytes`,
      },
    };
    return c.json(body, 413);
  }
  return next();
};
