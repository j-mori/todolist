import type { MiddlewareHandler } from 'hono';
import type { Logger } from 'pino';
import { REQUEST_ID_VAR, type RequestIdEnv } from './request-id.ts';

export type RequestLoggerEnv = RequestIdEnv;

const levelFor = (status: number): 'info' | 'warn' | 'error' => {
  if (status >= 500) return 'error';
  if (status >= 400) return 'warn';
  return 'info';
};

export const requestLogger = (logger: Logger): MiddlewareHandler<RequestLoggerEnv> =>
  async (c, next) => {
    const start = performance.now();
    await next();
    const latency_ms = Math.round((performance.now() - start) * 100) / 100;
    const status = c.res.status;
    const fields = {
      request_id: c.get(REQUEST_ID_VAR),
      method: c.req.method,
      path: new URL(c.req.url).pathname,
      status,
      latency_ms,
    };
    logger[levelFor(status)](fields, 'http_request');
  };
