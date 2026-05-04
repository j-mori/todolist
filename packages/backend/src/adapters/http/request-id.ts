import type { MiddlewareHandler } from 'hono';

export const REQUEST_ID_HEADER = 'X-Request-Id';
export const REQUEST_ID_VAR = 'requestId';

export type RequestIdEnv = {
  Variables: { [REQUEST_ID_VAR]: string };
};

export const requestId = (): MiddlewareHandler<RequestIdEnv> => async (c, next) => {
  const incoming = c.req.header(REQUEST_ID_HEADER);
  const id = incoming && incoming.length > 0 ? incoming : crypto.randomUUID();
  c.set(REQUEST_ID_VAR, id);
  c.header(REQUEST_ID_HEADER, id);
  await next();
};
