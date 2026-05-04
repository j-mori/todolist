import { promisify } from 'node:util';
import { serve } from '@hono/node-server';
import { pino } from 'pino';
import { loadConfig } from './config.ts';
import { composeProduction } from './main.ts';

const config = loadConfig(process.env);

const logger = pino({
  name: 'todolist-backend',
  level: config.logLevel,
  redact: {
    // Defensive defaults: even though no payload currently carries these,
    // guard against accidental leaks from a future field.
    paths: ['*.password', '*.token', '*.authorization', 'req.headers.authorization'],
    censor: '[redacted]',
  },
});

const composed = await composeProduction({
  databasePath: config.databasePath,
  logger,
  corsOrigin: config.corsOrigin,
  maxBodyBytes: config.maxBodyBytes,
});

const server = serve({ fetch: composed.app.fetch, port: config.port }, (info) => {
  logger.info(
    { port: info.port, databasePath: config.databasePath, env: config.nodeEnv },
    'backend listening',
  );
});

const closeServer = promisify(server.close.bind(server));

const shutdown = async (signal: string): Promise<void> => {
  logger.info({ signal }, 'shutting down');
  try {
    await closeServer();
    await composed.dispose();
    process.exit(0);
  } catch (err) {
    logger.error({ err }, 'shutdown_failed');
    process.exit(1);
  }
};

process.on('SIGINT', () => {
  void shutdown('SIGINT');
});
process.on('SIGTERM', () => {
  void shutdown('SIGTERM');
});

process.on('uncaughtException', (err) => {
  logger.fatal({ err }, 'uncaught_exception');
  process.exit(1);
});
process.on('unhandledRejection', (reason) => {
  logger.fatal({ reason }, 'unhandled_rejection');
  process.exit(1);
});
