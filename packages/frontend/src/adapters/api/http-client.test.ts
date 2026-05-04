import { taskListSchema } from '@todolist/shared';
import { describe, expect, it } from 'vitest';
import { z } from 'zod';
import { createHttpClient } from './http-client.ts';

type FetchImpl = typeof fetch;

const FIXED_ID = '00000000-0000-4000-8000-000000000000';
const SERVER_ID = '11111111-1111-4111-8111-111111111111';

const toRequest = (input: RequestInfo | URL, init?: RequestInit): Request =>
  input instanceof Request ? new Request(input, init) : new Request(input.toString(), init);

const fetchReturning = (
  response: Response,
  captured?: { request?: Request },
): FetchImpl => {
  return (input, init) => {
    if (captured) captured.request = toRequest(input, init);
    return Promise.resolve(response);
  };
};

const jsonResponse = (status: number, body: unknown, headers?: Record<string, string>): Response =>
  new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json', ...headers },
  });

describe('createHttpClient', () => {
  it('emits a generated X-Request-Id header when none is supplied', async () => {
    const captured: { request?: Request } = {};
    const client = createHttpClient({
      baseUrl: '/api',
      generateRequestId: () => FIXED_ID,
      fetchImpl: fetchReturning(jsonResponse(200, []), captured),
    });

    const result = await client.request({
      method: 'GET',
      path: '/tasks',
      responseSchema: taskListSchema,
    });

    expect(result.ok).toBe(true);
    expect(captured.request?.headers.get('x-request-id')).toBe(FIXED_ID);
    expect(captured.request?.url).toContain('/api/tasks');
  });

  it('prefers the server X-Request-Id over the generated one on errors', async () => {
    const client = createHttpClient({
      baseUrl: '/api',
      generateRequestId: () => FIXED_ID,
      fetchImpl: fetchReturning(
        jsonResponse(
          500,
          { error: { kind: 'InternalError', requestId: SERVER_ID } },
          { 'x-request-id': SERVER_ID },
        ),
      ),
    });

    const result = await client.request({
      method: 'GET',
      path: '/tasks',
      responseSchema: taskListSchema,
    });

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.kind).toBe('InternalError');
    expect(result.error.requestId).toBe(SERVER_ID);
  });

  it('returns ContractViolation when a 200 body fails the response schema', async () => {
    const client = createHttpClient({
      baseUrl: '/api',
      generateRequestId: () => FIXED_ID,
      fetchImpl: fetchReturning(jsonResponse(200, { wrong: 'shape' })),
    });

    const result = await client.request({
      method: 'GET',
      path: '/tasks',
      responseSchema: taskListSchema,
    });

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.kind).toBe('ContractViolation');
    expect(result.error.requestId).toBe(FIXED_ID);
  });

  it('maps a 400 ValidationError envelope to a typed ApiClientError', async () => {
    const client = createHttpClient({
      baseUrl: '/api',
      generateRequestId: () => FIXED_ID,
      fetchImpl: fetchReturning(
        jsonResponse(400, {
          error: { kind: 'ValidationError', field: 'title', reason: 'must not be empty' },
        }),
      ),
    });

    const result = await client.request({
      method: 'POST',
      path: '/tasks',
      body: { title: '' },
      responseSchema: z.unknown(),
    });

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.kind).toBe('ValidationError');
    if (result.error.kind !== 'ValidationError') return;
    expect(result.error.field).toBe('title');
    expect(result.error.reason).toBe('must not be empty');
    expect(result.error.requestId).toBe(FIXED_ID);
  });

  it('returns NetworkError when fetch rejects', async () => {
    const rejectingFetch: FetchImpl = () => Promise.reject(new TypeError('offline'));
    const client = createHttpClient({
      baseUrl: '/api',
      generateRequestId: () => FIXED_ID,
      fetchImpl: rejectingFetch,
    });

    const result = await client.request({
      method: 'GET',
      path: '/tasks',
      responseSchema: taskListSchema,
    });

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.kind).toBe('NetworkError');
    expect(result.error.requestId).toBe(FIXED_ID);
  });
});
