import { strict as assert } from 'node:assert';
import { describe, it } from 'node:test';
import { createApp } from './app.ts';

describe('http app', () => {
  it('GET /health returns 200 with status payload', async () => {
    const app = createApp();
    const res = await app.request('/health');

    assert.equal(res.status, 200);
    const body = (await res.json()) as { status: string };
    assert.equal(body.status, 'ok');
  });
});
