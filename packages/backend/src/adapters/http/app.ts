import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { type Logger, pino } from 'pino';
import type { Clock } from '../../application/ports/clock.ts';
import type { IdGenerator } from '../../application/ports/id-generator.ts';
import type { TaskRepository } from '../../application/ports/task-repository.ts';
import { internalErrorHandler } from './error-handler.ts';
import { requestId, type RequestIdEnv } from './request-id.ts';
import { requestLogger } from './request-logger.ts';
import { createTaskRoutes } from './routes/tasks.ts';

export type CreateAppDeps = {
  tasks: TaskRepository;
  clock: Clock;
  ids: IdGenerator;
  logger?: Logger;
  corsOrigin?: string | string[];
};

export const DEFAULT_CORS_ORIGIN = 'http://localhost:8081';

export const createApp = (deps: CreateAppDeps): Hono<RequestIdEnv> => {
  const logger = deps.logger ?? pino({ name: 'todolist-backend', level: 'silent' });
  const app = new Hono<RequestIdEnv>();

  app.use('*', requestId());
  app.use('*', requestLogger(logger));
  app.use(
    '*',
    cors({
      origin: deps.corsOrigin ?? DEFAULT_CORS_ORIGIN,
      allowHeaders: ['Content-Type', 'X-Request-Id'],
      allowMethods: ['GET', 'POST', 'PATCH', 'DELETE', 'OPTIONS'],
      exposeHeaders: ['X-Request-Id', 'Location'],
      maxAge: 600,
    }),
  );

  app.get('/health', (c) => c.json({ status: 'ok' }));
  app.route('/tasks', createTaskRoutes({ tasks: deps.tasks, clock: deps.clock, ids: deps.ids }));

  app.onError(internalErrorHandler(logger));

  return app;
};
