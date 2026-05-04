import { serve } from '@hono/node-server';
import { pino } from 'pino';
import { compose } from './main.ts';

const log = pino({ name: 'todolist-backend' });
const port = Number.parseInt(process.env.PORT ?? '3000', 10);
const databasePath = process.env.DATABASE_PATH ?? '/data/todolist.db';
const corsOrigin = process.env.CORS_ORIGIN
  ? process.env.CORS_ORIGIN.split(',').map((s) => s.trim())
  : undefined;

const { app, dispose } = await compose({
  databasePath,
  logger: log,
  ...(corsOrigin !== undefined ? { corsOrigin } : {}),
});

const server = serve({ fetch: app.fetch, port }, (info) => {
  log.info({ port: info.port, databasePath }, 'backend listening');
});

const shutdown = async (signal: string): Promise<void> => {
  log.info({ signal }, 'shutting down');
  server.close();
  await dispose();
  process.exit(0);
};

process.on('SIGINT', () => {
  void shutdown('SIGINT');
});
process.on('SIGTERM', () => {
  void shutdown('SIGTERM');
});
