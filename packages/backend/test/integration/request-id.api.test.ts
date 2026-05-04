import { strict as assert } from 'node:assert';
import { test } from 'node:test';
import { startApi } from './_helpers.ts';

test('X-Request-Id is echoed on the response when supplied by the caller', async (t) => {
  const api = await startApi();
  t.after(() => api.dispose());

  const res = await api.request('/health', { headers: { 'X-Request-Id': 'abc-123' } });
  assert.equal(res.headers.get('X-Request-Id'), 'abc-123');
});

test('X-Request-Id is generated as a UUID v4 when the caller does not supply one', async (t) => {
  const api = await startApi();
  t.after(() => api.dispose());

  const res = await api.request('/health');
  const id = res.headers.get('X-Request-Id');
  assert.ok(id);
  assert.match(id, /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i);
});
