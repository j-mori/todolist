import type { ErrorHandler } from 'hono';
import type { Logger } from 'pino';
import type { ErrorResponse } from '@todolist/shared';
import { REQUEST_ID_VAR, type RequestIdEnv } from './request-id.ts';

export const internalErrorHandler = (logger: Logger): ErrorHandler<RequestIdEnv> =>
  (err, c) => {
    const requestId = c.get(REQUEST_ID_VAR);
    logger.error({ err, request_id: requestId }, 'unhandled_error');
    const body: ErrorResponse = { error: { kind: 'InternalError', requestId } };
    return c.json(body, 500);
  };
