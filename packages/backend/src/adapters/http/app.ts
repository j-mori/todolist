import { Hono } from 'hono';
import { logger } from 'hono/logger';

export const createApp = (): Hono => {
  const app = new Hono();

  app.use('*', logger());

  app.get('/health', (c) => c.json({ status: 'ok' }));

  return app;
};
