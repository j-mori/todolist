import { promisify } from 'node:util';
import { serve } from '@hono/node-server';
import { pino } from 'pino';
import { openWiredDatabase } from './adapters/persistence/sqlite/wiring.ts';
import { loadConfig } from './config.ts';
import { compose, productionClock, productionIdGenerator } from './main.ts';

const config = loadConfig(process.env);

const logger = pino({
  name: 'todolist-backend',
  level: config.logLevel,
  redact: {
    paths: ['*.password', '*.token', '*.authorization', 'req.headers.authorization'],
    censor: '[redacted]',
  },
});

const database = await openWiredDatabase(config.databasePath);

const { app } = compose({
  tasks: database.repo,
  clock: productionClock,
  ids: productionIdGenerator,
  logger,
  corsOrigin: config.corsOrigin,
  maxBodyBytes: config.maxBodyBytes,
  readiness: database.readiness,
});

const server = serve({ fetch: app.fetch, port: config.port }, (info) => {
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
    await database.dispose();
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
