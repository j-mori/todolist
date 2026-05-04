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
  assert.ok(res.headers.get('X-Content-Type-Options'), 'missing X-Content-Type-Options');
  assert.equal(res.headers.get('X-Content-Type-Options'), 'nosniff');
  assert.ok(res.headers.get('X-Frame-Options'), 'missing X-Frame-Options');
  assert.ok(res.headers.get('Referrer-Policy'), 'missing Referrer-Policy');
});
