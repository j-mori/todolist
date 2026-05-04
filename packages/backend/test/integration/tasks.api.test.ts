import { strict as assert } from 'node:assert';
import { test } from 'node:test';
import { type Task, taskListSchema, taskSchema } from '@todolist/shared';
import { TASK_IDS } from '../../src/domain/task/task.test-support.ts';
import { expectApiError, jsonRequest, readJson, startApi } from './_helpers.ts';

test('POST /tasks creates a task and returns 201 with a Location header', async (t) => {
  const api = await startApi();
  t.after(() => api.dispose());

  const res = await api.request('/tasks', jsonRequest({ title: 'Buy milk' }));
  assert.equal(res.status, 201);
  const body = await readJson<Task>(res);
  taskSchema.parse(body); // throws if the wire shape drifts
  assert.equal(body.title, 'Buy milk');
  assert.equal(body.status, 'pending');
  assert.equal(body.id, api.ids.issued[0]);
  assert.equal(res.headers.get('Location'), `/tasks/${body.id}`);
});

test('POST /tasks rejects whitespace-only title with 400 ValidationError(field=title)', async (t) => {
  const api = await startApi();
  t.after(() => api.dispose());

  const res = await api.request('/tasks', jsonRequest({ title: '   ' }));
  assert.equal(res.status, 400);
  const error = await expectApiError(res, 'ValidationError');
  assert.equal(error.field, 'title');
});

test('POST /tasks rejects missing title with 400 ValidationError(field=title)', async (t) => {
  const api = await startApi();
  t.after(() => api.dispose());

  const res = await api.request('/tasks', jsonRequest({}));
  assert.equal(res.status, 400);
  const error = await expectApiError(res, 'ValidationError');
  assert.equal(error.field, 'title');
});

test('POST /tasks rejects malformed JSON body with 400 ValidationError(field=body)', async (t) => {
  const api = await startApi();
  t.after(() => api.dispose());

  const res = await api.request('/tasks', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: 'not-json',
  });
  assert.equal(res.status, 400);
  const error = await expectApiError(res, 'ValidationError');
  assert.equal(error.field, 'body');
});

test('GET /tasks returns the list in createdAt-descending order', async (t) => {
  const api = await startApi();
  t.after(() => api.dispose());

  const a = await readJson<Task>(await api.request('/tasks', jsonRequest({ title: 'first' })));
  api.clock.advance(1000);
  const b = await readJson<Task>(await api.request('/tasks', jsonRequest({ title: 'second' })));
  api.clock.advance(1000);
  const c = await readJson<Task>(await api.request('/tasks', jsonRequest({ title: 'third' })));

  const res = await api.request('/tasks');
  assert.equal(res.status, 200);
  const list = await readJson<Task[]>(res);
  taskListSchema.parse(list);
  assert.deepEqual(
    list.map((task) => task.id),
    [c.id, b.id, a.id],
  );
});

test('PATCH /tasks/:id updates the title and advances updatedAt', async (t) => {
  const api = await startApi();
  t.after(() => api.dispose());

  const created = await readJson<Task>(await api.request('/tasks', jsonRequest({ title: 'old' })));
  api.clock.advance(60_000);
  const res = await api.request(
    `/tasks/${created.id}`,
    jsonRequest({ title: 'new' }, { method: 'PATCH' }),
  );
  assert.equal(res.status, 200);
  const updated = await readJson<Task>(res);
  assert.equal(updated.title, 'new');
  assert.equal(updated.id, created.id);
  assert.equal(updated.createdAt, created.createdAt);
  assert.equal(updated.updatedAt, '2026-05-04T10:01:00.000Z');
});

test('PATCH /tasks/:id is idempotent when the title is unchanged: same updatedAt', async (t) => {
  const api = await startApi();
  t.after(() => api.dispose());

  const created = await readJson<Task>(await api.request('/tasks', jsonRequest({ title: 'same' })));
  api.clock.advance(60_000);
  const res = await api.request(
    `/tasks/${created.id}`,
    jsonRequest({ title: 'same' }, { method: 'PATCH' }),
  );
  assert.equal(res.status, 200);
  const noop = await readJson<Task>(res);
  assert.equal(noop.updatedAt, created.updatedAt);
});

test('PATCH /tasks/:id with unknown id returns 404 TaskNotFound', async (t) => {
  const api = await startApi();
  t.after(() => api.dispose());

  const res = await api.request(
    `/tasks/${TASK_IDS.X}`,
    jsonRequest({ title: 'whatever' }, { method: 'PATCH' }),
  );
  assert.equal(res.status, 404);
  const error = await expectApiError(res, 'TaskNotFound');
  assert.equal(error.id, TASK_IDS.X);
});

test('PATCH /tasks/:id with non-uuid id returns 400 ValidationError(field=id)', async (t) => {
  const api = await startApi();
  t.after(() => api.dispose());

  const res = await api.request(
    '/tasks/not-a-uuid',
    jsonRequest({ title: 'x' }, { method: 'PATCH' }),
  );
  assert.equal(res.status, 400);
  const error = await expectApiError(res, 'ValidationError');
  assert.equal(error.field, 'id');
});

test('POST /tasks/:id/complete marks completed; second call is a no-op (same updatedAt)', async (t) => {
  const api = await startApi();
  t.after(() => api.dispose());

  const created = await readJson<Task>(await api.request('/tasks', jsonRequest({ title: 'x' })));
  api.clock.advance(60_000);
  const first = await readJson<Task>(
    await api.request(`/tasks/${created.id}/complete`, { method: 'POST' }),
  );
  assert.equal(first.status, 'completed');
  assert.equal(first.updatedAt, '2026-05-04T10:01:00.000Z');

  api.clock.advance(60_000);
  const res = await api.request(`/tasks/${created.id}/complete`, { method: 'POST' });
  assert.equal(res.status, 200);
  const second = await readJson<Task>(res);
  assert.equal(second.status, 'completed');
  assert.equal(second.updatedAt, first.updatedAt);
});

test('POST /tasks/:id/reopen flips completed back to pending; idempotent on already-pending', async (t) => {
  const api = await startApi();
  t.after(() => api.dispose());

  const created = await readJson<Task>(await api.request('/tasks', jsonRequest({ title: 'x' })));
  await api.request(`/tasks/${created.id}/complete`, { method: 'POST' });
  api.clock.advance(60_000);

  const reopened = await readJson<Task>(
    await api.request(`/tasks/${created.id}/reopen`, { method: 'POST' }),
  );
  assert.equal(reopened.status, 'pending');

  api.clock.advance(60_000);
  const idempotent = await readJson<Task>(
    await api.request(`/tasks/${created.id}/reopen`, { method: 'POST' }),
  );
  assert.equal(idempotent.status, 'pending');
  assert.equal(idempotent.updatedAt, reopened.updatedAt);
});

test('DELETE /tasks/:id returns 204 and the task disappears from GET /tasks', async (t) => {
  const api = await startApi();
  t.after(() => api.dispose());

  const created = await readJson<Task>(await api.request('/tasks', jsonRequest({ title: 'x' })));
  const del = await api.request(`/tasks/${created.id}`, { method: 'DELETE' });
  assert.equal(del.status, 204);
  assert.equal(await del.text(), '');

  const list = await readJson<Task[]>(await api.request('/tasks'));
  assert.deepEqual(list, []);
});

test('DELETE /tasks/:id with unknown id returns 404 TaskNotFound', async (t) => {
  const api = await startApi();
  t.after(() => api.dispose());

  const res = await api.request(`/tasks/${TASK_IDS.X}`, { method: 'DELETE' });
  assert.equal(res.status, 404);
  await expectApiError(res, 'TaskNotFound');
});

test('state survives across calls within a single composed app (real SQLite round-trip)', async (t) => {
  const api = await startApi();
  t.after(() => api.dispose());

  const created = await readJson<Task>(
    await api.request('/tasks', jsonRequest({ title: 'persisted' })),
  );
  await api.request('/healthz');
  await api.request('/tasks');

  const list = await readJson<Task[]>(await api.request('/tasks'));
  assert.equal(list.length, 1);
  assert.equal(list[0]?.id, created.id);
});
