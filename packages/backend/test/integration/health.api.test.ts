import { strict as assert } from 'node:assert';
import { test } from 'node:test';
import { readJson, startApi } from './_helpers.ts';

test('GET /healthz returns 200 with status payload (liveness)', async (t) => {
  const api = await startApi();
  t.after(() => api.dispose());

  const res = await api.request('/healthz');
  assert.equal(res.status, 200);
  const body = await readJson<{ status: string }>(res);
  assert.equal(body.status, 'ok');
});

test('GET /health is preserved as a back-compat alias for /healthz', async (t) => {
  const api = await startApi();
  t.after(() => api.dispose());

  const res = await api.request('/health');
  assert.equal(res.status, 200);
});

test('GET /readyz returns 200 when the database probe succeeds', async (t) => {
  const api = await startApi();
  t.after(() => api.dispose());

  const res = await api.request('/readyz');
  assert.equal(res.status, 200);
  const body = await readJson<{ status: string }>(res);
  assert.equal(body.status, 'ok');
});

test('GET /readyz returns 503 when the database has been disposed', async () => {
  const api = await startApi();
  // Dispose first; then probe must surface the failure.
  await api.dispose();

  const res = await api.request('/readyz');
  assert.equal(res.status, 503);
  const body = await readJson<{ status: string }>(res);
  assert.equal(body.status, 'not_ready');
});
