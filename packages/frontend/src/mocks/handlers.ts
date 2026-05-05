import {
  addTaskRequestSchema,
  TASK_TITLE_MAX_LENGTH,
  TASK_TITLE_MIN_LENGTH,
  type Task,
  taskIdParamSchema,
  updateTaskRequestSchema,
  type ValidationErrorBody,
} from '@todolist/shared';
import { HttpResponse, http } from 'msw';

const TITLE_FIELD = 'title';
const ID_FIELD = 'id';

const validationError = (field: string, reason: string): { error: ValidationErrorBody } => ({
  error: { kind: 'ValidationError', field, reason },
});

const notFound = (id: string) => ({
  error: { kind: 'TaskNotFound' as const, id },
});

const newest = (a: Task, b: Task): number => b.createdAt.localeCompare(a.createdAt);

const tasks = new Map<string, Task>();

const seed = (): void => {
  const now = Date.now();
  const offset = (minutesAgo: number): string => new Date(now - minutesAgo * 60_000).toISOString();
  const seedTasks: ReadonlyArray<Task> = [
    {
      id: '7c9c9b6d-8b7e-4a3a-9d4f-2a3a8a3a8a3a',
      title: 'Skim the README',
      status: 'pending',
      createdAt: offset(1),
      updatedAt: offset(1),
    },
    {
      id: '2d8b6c4f-1e3a-4f6b-8c9d-2e4f6a8b0c1d',
      title: 'Open the Architecture page',
      status: 'pending',
      createdAt: offset(15),
      updatedAt: offset(15),
    },
    {
      id: 'b9d2a1f4-5c8e-4f3b-91a7-4d2e9f1c8b3a',
      title: 'Browse the ADR index',
      status: 'completed',
      createdAt: offset(45),
      updatedAt: offset(30),
    },
    {
      id: '3e7a5b9c-2d1f-4a6b-8c9d-1e2f3a4b5c6d',
      title: 'Try adding, completing, and deleting a task',
      status: 'pending',
      createdAt: offset(120),
      updatedAt: offset(120),
    },
    {
      id: 'f1a2b3c4-d5e6-4f7a-8b9c-0d1e2f3a4b5c',
      title: 'Star the repo on GitHub',
      status: 'completed',
      createdAt: offset(720),
      updatedAt: offset(600),
    },
  ];
  for (const task of seedTasks) tasks.set(task.id, task);
};
seed();

const validateTitle = (
  raw: string,
): { ok: true; title: string } | { ok: false; reason: string } => {
  const trimmed = raw.trim();
  if (trimmed.length < TASK_TITLE_MIN_LENGTH) return { ok: false, reason: 'must not be empty' };
  if (trimmed.length > TASK_TITLE_MAX_LENGTH) {
    return { ok: false, reason: `must be at most ${TASK_TITLE_MAX_LENGTH} characters` };
  }
  return { ok: true, title: trimmed };
};

const parseId = (
  rawId: string | readonly string[] | undefined,
): { ok: true; id: string } | { ok: false; reason: string } => {
  if (typeof rawId !== 'string') return { ok: false, reason: 'must be a v4 UUID' };
  const parsed = taskIdParamSchema.safeParse({ id: rawId });
  if (!parsed.success) return { ok: false, reason: 'must be a v4 UUID' };
  return { ok: true, id: parsed.data.id };
};

export const handlers = [
  http.get('/api/healthz', () => HttpResponse.json({ status: 'ok' })),
  http.get('/api/readyz', () => HttpResponse.json({ status: 'ok' })),

  http.get('/api/tasks', () => {
    const list = [...tasks.values()].sort(newest);
    return HttpResponse.json(list);
  }),

  http.post('/api/tasks', async ({ request }) => {
    const raw = await request.json();
    const parsed = addTaskRequestSchema.safeParse(raw);
    if (!parsed.success) {
      return HttpResponse.json(validationError(TITLE_FIELD, 'must be a string'), { status: 400 });
    }
    const checked = validateTitle(parsed.data.title);
    if (!checked.ok) {
      return HttpResponse.json(validationError(TITLE_FIELD, checked.reason), { status: 400 });
    }
    const nowIso = new Date().toISOString();
    const task: Task = {
      id: crypto.randomUUID(),
      title: checked.title,
      status: 'pending',
      createdAt: nowIso,
      updatedAt: nowIso,
    };
    tasks.set(task.id, task);
    return HttpResponse.json(task, {
      status: 201,
      headers: { Location: `/tasks/${task.id}` },
    });
  }),

  http.patch('/api/tasks/:id', async ({ params, request }) => {
    const idCheck = parseId(params.id);
    if (!idCheck.ok) {
      return HttpResponse.json(validationError(ID_FIELD, idCheck.reason), { status: 400 });
    }
    const raw = await request.json();
    const parsed = updateTaskRequestSchema.safeParse(raw);
    if (!parsed.success) {
      return HttpResponse.json(validationError(TITLE_FIELD, 'must be a string'), { status: 400 });
    }
    const checked = validateTitle(parsed.data.title);
    if (!checked.ok) {
      return HttpResponse.json(validationError(TITLE_FIELD, checked.reason), { status: 400 });
    }
    const existing = tasks.get(idCheck.id);
    if (!existing) return HttpResponse.json(notFound(idCheck.id), { status: 404 });
    const updated: Task = {
      ...existing,
      title: checked.title,
      updatedAt: new Date().toISOString(),
    };
    tasks.set(updated.id, updated);
    return HttpResponse.json(updated);
  }),

  http.post('/api/tasks/:id/complete', ({ params }) => {
    const idCheck = parseId(params.id);
    if (!idCheck.ok) {
      return HttpResponse.json(validationError(ID_FIELD, idCheck.reason), { status: 400 });
    }
    const existing = tasks.get(idCheck.id);
    if (!existing) return HttpResponse.json(notFound(idCheck.id), { status: 404 });
    if (existing.status === 'completed') return HttpResponse.json(existing);
    const updated: Task = { ...existing, status: 'completed', updatedAt: new Date().toISOString() };
    tasks.set(updated.id, updated);
    return HttpResponse.json(updated);
  }),

  http.post('/api/tasks/:id/reopen', ({ params }) => {
    const idCheck = parseId(params.id);
    if (!idCheck.ok) {
      return HttpResponse.json(validationError(ID_FIELD, idCheck.reason), { status: 400 });
    }
    const existing = tasks.get(idCheck.id);
    if (!existing) return HttpResponse.json(notFound(idCheck.id), { status: 404 });
    if (existing.status === 'pending') return HttpResponse.json(existing);
    const updated: Task = { ...existing, status: 'pending', updatedAt: new Date().toISOString() };
    tasks.set(updated.id, updated);
    return HttpResponse.json(updated);
  }),

  http.delete('/api/tasks/:id', ({ params }) => {
    const idCheck = parseId(params.id);
    if (!idCheck.ok) {
      return HttpResponse.json(validationError(ID_FIELD, idCheck.reason), { status: 400 });
    }
    if (!tasks.has(idCheck.id)) return HttpResponse.json(notFound(idCheck.id), { status: 404 });
    tasks.delete(idCheck.id);
    return new HttpResponse(null, { status: 204 });
  }),
];
