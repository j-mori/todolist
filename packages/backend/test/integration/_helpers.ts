import { pino } from 'pino';
import {
  errorResponseSchema,
  type ApiError,
  type ErrorResponse,
} from '@todolist/shared';
import {
  createFixedClock,
  type FixedClock,
} from '../../src/application/test-support/fixed-clock.test-support.ts';
import {
  createSequentialIdGenerator,
  type SequentialIdGenerator,
} from '../../src/application/test-support/sequential-id-generator.test-support.ts';
import { composeProduction } from '../../src/main.ts';

const TEST_INITIAL_TIME = '2026-05-04T10:00:00.000Z';
const TEST_MAX_BODY_BYTES = 64 * 1024;

export type TestApi = {
  request(path: string, init?: RequestInit): Promise<Response>;
  clock: FixedClock;
  ids: SequentialIdGenerator;
  dispose(): Promise<void>;
};

/**
 * Spin up the production wiring with deterministic clock + ids and an
 * in-memory SQLite. Tests get the same factory production uses, plus the
 * means to advance time and inspect issued ids without touching globals.
 */
export const startApi = async (): Promise<TestApi> => {
  const clock = createFixedClock(new Date(TEST_INITIAL_TIME));
  const ids = createSequentialIdGenerator();
  const composed = await composeProduction({
    databasePath: ':memory:',
    logger: pino({ name: 'todolist-backend-test', level: 'silent' }),
    corsOrigin: '*',
    maxBodyBytes: TEST_MAX_BODY_BYTES,
    clock,
    ids,
  });
  return {
    request: async (path, init) => composed.app.request(path, init),
    clock,
    ids,
    dispose: composed.dispose,
  };
};

export const jsonRequest = (body: unknown, init?: RequestInit): RequestInit => ({
  ...init,
  method: init?.method ?? 'POST',
  headers: { 'content-type': 'application/json', ...(init?.headers ?? {}) },
  body: JSON.stringify(body),
});

export const readJson = async <T>(res: Response): Promise<T> => (await res.json()) as T;

/**
 * Assert that the response carries the canonical error envelope and return
 * the typed `error` payload narrowed to a specific `kind`.
 *
 * Tests should never inline-type error response shapes — drift between the
 * shared schema and inline types is the bug class this guards against.
 */
export const expectApiError = async <K extends ApiError['kind']>(
  res: Response,
  kind: K,
): Promise<Extract<ApiError, { kind: K }>> => {
  const body = (await res.json()) as unknown;
  const parsed = errorResponseSchema.safeParse(body);
  if (!parsed.success) {
    throw new Error(`response body did not match errorResponseSchema: ${JSON.stringify(body)}`);
  }
  const envelope: ErrorResponse = parsed.data;
  if (envelope.error.kind !== kind) {
    throw new Error(`expected error.kind=${kind}, got ${envelope.error.kind}`);
  }
  return envelope.error as Extract<ApiError, { kind: K }>;
};
