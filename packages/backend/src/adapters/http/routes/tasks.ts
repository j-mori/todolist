import { type Context, Hono } from 'hono';
import {
  addTaskRequestSchema,
  taskIdParamSchema,
  updateTaskRequestSchema,
} from '@todolist/shared';
import { addTask } from '../../../application/use-cases/add-task.ts';
import { completeTask } from '../../../application/use-cases/complete-task.ts';
import { deleteTask } from '../../../application/use-cases/delete-task.ts';
import { listTasks } from '../../../application/use-cases/list-tasks.ts';
import { reopenTask } from '../../../application/use-cases/reopen-task.ts';
import { updateTask } from '../../../application/use-cases/update-task.ts';
import type { Clock } from '../../../application/ports/clock.ts';
import type { IdGenerator } from '../../../application/ports/id-generator.ts';
import type { TaskRepository } from '../../../application/ports/task-repository.ts';
import { respondWithTask, respondWithValidationError, respondWithVoid, taskToWire } from '../respond.ts';

export type TaskRoutesDeps = {
  tasks: TaskRepository;
  clock: Clock;
  ids: IdGenerator;
};

const INVALID_JSON = Symbol('invalid-json');

const safeJson = async (c: Context): Promise<unknown | typeof INVALID_JSON> => {
  try {
    return await c.req.json();
  } catch {
    return INVALID_JSON;
  }
};

const parseId = (raw: string) => taskIdParamSchema.safeParse({ id: raw });

export const createTaskRoutes = (deps: TaskRoutesDeps): Hono => {
  const router = new Hono();

  router.get('/', async (c) => {
    const list = await listTasks({ tasks: deps.tasks });
    return c.json(list.map(taskToWire), 200);
  });

  router.post('/', async (c) => {
    const body = await safeJson(c);
    if (body === INVALID_JSON) {
      return respondWithValidationError(c, 'body', 'malformed JSON');
    }
    const parsed = addTaskRequestSchema.safeParse(body);
    if (!parsed.success) {
      const issue = parsed.error.issues[0];
      const field = issue ? issue.path.join('.') || 'body' : 'body';
      const reason = issue ? issue.message : 'invalid request';
      return respondWithValidationError(c, field, reason);
    }
    const result = await addTask(parsed.data, deps);
    if (result.ok) {
      c.header('Location', `/tasks/${result.value.id}`);
    }
    return respondWithTask(c, result, 201);
  });

  router.patch('/:id', async (c) => {
    const idParam = parseId(c.req.param('id'));
    if (!idParam.success) {
      return respondWithValidationError(c, 'id', 'must be a UUID v4');
    }
    const body = await safeJson(c);
    if (body === INVALID_JSON) {
      return respondWithValidationError(c, 'body', 'malformed JSON');
    }
    const parsed = updateTaskRequestSchema.safeParse(body);
    if (!parsed.success) {
      const issue = parsed.error.issues[0];
      const field = issue ? issue.path.join('.') || 'body' : 'body';
      const reason = issue ? issue.message : 'invalid request';
      return respondWithValidationError(c, field, reason);
    }
    const result = await updateTask(
      { id: idParam.data.id, title: parsed.data.title },
      { tasks: deps.tasks, clock: deps.clock },
    );
    return respondWithTask(c, result, 200);
  });

  router.post('/:id/complete', async (c) => {
    const idParam = parseId(c.req.param('id'));
    if (!idParam.success) {
      return respondWithValidationError(c, 'id', 'must be a UUID v4');
    }
    const result = await completeTask(
      { id: idParam.data.id },
      { tasks: deps.tasks, clock: deps.clock },
    );
    return respondWithTask(c, result, 200);
  });

  router.post('/:id/reopen', async (c) => {
    const idParam = parseId(c.req.param('id'));
    if (!idParam.success) {
      return respondWithValidationError(c, 'id', 'must be a UUID v4');
    }
    const result = await reopenTask(
      { id: idParam.data.id },
      { tasks: deps.tasks, clock: deps.clock },
    );
    return respondWithTask(c, result, 200);
  });

  router.delete('/:id', async (c) => {
    const idParam = parseId(c.req.param('id'));
    if (!idParam.success) {
      return respondWithValidationError(c, 'id', 'must be a UUID v4');
    }
    const result = await deleteTask({ id: idParam.data.id }, { tasks: deps.tasks });
    return respondWithVoid(c, result, 204);
  });

  return router;
};
