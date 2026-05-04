import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { secureHeaders } from 'hono/secure-headers';
import type { Logger } from 'pino';
import type { Clock } from '../../application/ports/clock.ts';
import type { IdGenerator } from '../../application/ports/id-generator.ts';
import type { TaskRepository } from '../../application/ports/task-repository.ts';
import { bodyLimit } from './body-limit.ts';
import { internalErrorHandler } from './error-handler.ts';
import { type RequestIdEnv, requestId } from './request-id.ts';
import { requestLogger } from './request-logger.ts';
import { createTaskRoutes } from './routes/tasks.ts';

export type ReadinessProbe = {
  /** Resolves on success, rejects with the underlying error on failure. */
  check(): Promise<void>;
};

export type CreateAppDeps = {
  tasks: TaskRepository;
  clock: Clock;
  ids: IdGenerator;
  logger: Logger;
  corsOrigin: string | string[];
  /** Maximum allowed request body size in bytes. */
  maxBodyBytes: number;
  /** Optional readiness probe wired into `GET /readyz`. */
  readiness?: ReadinessProbe;
};

export type App = Hono<RequestIdEnv>;

export const createApp = (deps: CreateAppDeps): App => {
  const app: App = new Hono<RequestIdEnv>();

  app.use('*', requestId());
  app.use('*', requestLogger(deps.logger));
  // The API serves JSON only — no scripts, no frames, no resources of any
  // kind should ever be loaded from these responses. The CSP is defensive:
  // any client that tries to embed or fetch sub-resources from the API gets
  // a hard no, even if a bug ever causes the API to serve HTML by accident.
  app.use(
    '*',
    secureHeaders({
      contentSecurityPolicy: {
        defaultSrc: ["'none'"],
        frameAncestors: ["'none'"],
      },
    }),
  );
  app.use(
    '*',
    cors({
      origin: deps.corsOrigin,
      allowHeaders: ['Content-Type', 'X-Request-Id'],
      allowMethods: ['GET', 'POST', 'PATCH', 'DELETE', 'OPTIONS'],
      exposeHeaders: ['X-Request-Id', 'Location'],
      maxAge: 600,
    }),
  );
  app.use('*', bodyLimit(deps.maxBodyBytes));

  // Liveness: process is up and responding. Cheap; no I/O.
  app.get('/healthz', (c) => c.json({ status: 'ok' }));
  // Back-compat alias for /healthz, in case anything still hits the old path.
  app.get('/health', (c) => c.json({ status: 'ok' }));

  // Readiness: the dependencies the app needs to do real work are reachable.
  app.get('/readyz', async (c) => {
    if (!deps.readiness) return c.json({ status: 'ok' }, 200);
    try {
      await deps.readiness.check();
      return c.json({ status: 'ok' }, 200);
    } catch (e) {
      deps.logger.warn({ err: e }, 'readiness_check_failed');
      return c.json({ status: 'not_ready' }, 503);
    }
  });

  app.route('/tasks', createTaskRoutes({ tasks: deps.tasks, clock: deps.clock, ids: deps.ids }));

  app.onError(internalErrorHandler(deps.logger));

  return app;
};
