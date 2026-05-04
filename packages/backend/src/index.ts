import { serve } from '@hono/node-server';
import { pino } from 'pino';
import { compose } from './main.ts';

const log = pino({ name: 'todolist-backend' });
const port = Number.parseInt(process.env.PORT ?? '3000', 10);

const { app } = compose();

serve({ fetch: app.fetch, port }, (info) => {
  log.info({ port: info.port }, 'backend listening');
});

const shutdown = (signal: string): void => {
  log.info({ signal }, 'shutting down');
  process.exit(0);
};

process.on('SIGINT', () => shutdown('SIGINT'));
process.on('SIGTERM', () => shutdown('SIGTERM'));
