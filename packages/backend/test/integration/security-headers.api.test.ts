import { strict as assert } from 'node:assert';
import { test } from 'node:test';
import { startApi } from './_helpers.ts';

/**
 * The exact set of secureHeaders defaults is Hono's, not ours; pinning a few
 * key ones is enough to prove the middleware is wired and would catch a
 * regression where it gets accidentally removed.
 */
test('responses carry baseline security headers', async (t) => {
  const api = await startApi();
  t.after(() => api.dispose());

  const res = await api.request('/healthz');
  assert.equal(res.headers.get('X-Content-Type-Options'), 'nosniff');
  assert.ok(res.headers.get('X-Frame-Options'), 'missing X-Frame-Options');
  assert.ok(res.headers.get('Referrer-Policy'), 'missing Referrer-Policy');
});

test('responses carry a strict Content-Security-Policy for the JSON API', async (t) => {
  const api = await startApi();
  t.after(() => api.dispose());

  const res = await api.request('/healthz');
  const csp = res.headers.get('Content-Security-Policy');
  assert.ok(csp, 'missing Content-Security-Policy');
  // Defensive: the API serves no scripts, no frames, no sub-resources.
  assert.match(csp, /default-src 'none'/);
  assert.match(csp, /frame-ancestors 'none'/);
});

test('responses do not advertise the framework via X-Powered-By', async (t) => {
  const api = await startApi();
  t.after(() => api.dispose());

  const res = await api.request('/healthz');
  assert.equal(res.headers.get('X-Powered-By'), null);
});
