import { strict as assert } from 'node:assert';
import { test } from 'node:test';
import { readJson, startApi } from './_helpers.ts';

test('GET /health returns 200 with status payload', async (t) => {
  const api = await startApi();
  t.after(() => api.dispose());

  const res = await api.request('/health');
  assert.equal(res.status, 200);
  const body = await readJson<{ status: string }>(res);
  assert.equal(body.status, 'ok');
});
