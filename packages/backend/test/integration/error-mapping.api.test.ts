import { strict as assert } from 'node:assert';
import { test } from 'node:test';
import { pino } from 'pino';
import { compose } from '../../src/main.ts';
import {
  createFixedClock,
} from '../../src/application/test-support/fixed-clock.test-support.ts';
import {
  createSequentialIdGenerator,
} from '../../src/application/test-support/sequential-id-generator.test-support.ts';
import type { TaskRepository } from '../../src/application/ports/task-repository.ts';
import { expectApiError } from './_helpers.ts';

class IntegrationTestError extends Error {
  constructor() {
    super('forced for test');
    this.name = 'IntegrationTestError';
  }
}

/** Repo that throws on every read — exercises the unhandled-error path through onError. */
const createExplodingRepository = (): TaskRepository => ({
  async save() {
    throw new IntegrationTestError();
  },
  async findById() {
    throw new IntegrationTestError();
  },
  async list() {
    throw new IntegrationTestError();
  },
  async delete() {
    throw new IntegrationTestError();
  },
});

const startWithExplodingRepo = () =>
  compose({
    tasks: createExplodingRepository(),
    clock: createFixedClock(new Date('2026-05-04T10:00:00Z')),
    ids: createSequentialIdGenerator(),
    logger: pino({ name: 'todolist-error-test', level: 'silent' }),
    corsOrigin: '*',
    maxBodyBytes: 64 * 1024,
  });

test('uncaught errors from a use case map to 500 with the InternalError envelope', async () => {
  const composed = startWithExplodingRepo();

  const res = await composed.app.request('/tasks');
  assert.equal(res.status, 500);
  const error = await expectApiError(res, 'InternalError');
  assert.match(error.requestId, /^[0-9a-f]{8}-[0-9a-f]{4}-4/i);
  assert.equal(res.headers.get('X-Request-Id'), error.requestId);
});

test('413 with ValidationError envelope when Content-Length exceeds the limit', async () => {
  const composed = compose({
    tasks: {
      async save() {},
      async findById() {
        return null;
      },
      async list() {
        return [];
      },
      async delete() {},
    },
    clock: createFixedClock(new Date('2026-05-04T10:00:00Z')),
    ids: createSequentialIdGenerator(),
    logger: pino({ name: 'todolist-error-test', level: 'silent' }),
    corsOrigin: '*',
    maxBodyBytes: 16,
  });

  const big = JSON.stringify({ title: 'x'.repeat(200) });
  const res = await composed.app.request('/tasks', {
    method: 'POST',
    headers: { 'content-type': 'application/json', 'content-length': String(big.length) },
    body: big,
  });
  assert.equal(res.status, 413);
  const error = await expectApiError(res, 'ValidationError');
  assert.equal(error.field, 'body');
});
