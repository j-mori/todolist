import { Hono } from 'hono';
import { addTaskRequestSchema, updateTaskRequestSchema } from '@todolist/shared';
import { addTask } from '../../../application/use-cases/add-task.ts';
import { completeTask } from '../../../application/use-cases/complete-task.ts';
import { deleteTask } from '../../../application/use-cases/delete-task.ts';
import { listTasks } from '../../../application/use-cases/list-tasks.ts';
import { reopenTask } from '../../../application/use-cases/reopen-task.ts';
import { updateTask } from '../../../application/use-cases/update-task.ts';
import type { Clock } from '../../../application/ports/clock.ts';
import type { IdGenerator } from '../../../application/ports/id-generator.ts';
import type { TaskRepository } from '../../../application/ports/task-repository.ts';
import { parseIdParam, parseJsonBody } from '../parse.ts';
import { respondCreated, respondNoContent, respondOk, respondValidationError } from '../respond.ts';
import { taskToWire } from '../wire.ts';

export type TaskRoutesDeps = {
  tasks: TaskRepository;
  clock: Clock;
  ids: IdGenerator;
};

export const createTaskRoutes = (deps: TaskRoutesDeps): Hono => {
  const router = new Hono();

  router.get('/', async (c) => {
    const list = await listTasks({ tasks: deps.tasks });
    return c.json(list.map(taskToWire), 200);
  });

  router.post('/', async (c) => {
    const body = await parseJsonBody(c, addTaskRequestSchema);
    if (!body.ok) return respondValidationError(c, body.error);

    const result = await addTask(body.value, deps);
    if (result.ok) {
      c.header('Location', `/tasks/${result.value.id}`);
    }
    return respondCreated(c, result);
  });

  router.patch('/:id', async (c) => {
    const id = parseIdParam(c);
    if (!id.ok) return respondValidationError(c, id.error);

    const body = await parseJsonBody(c, updateTaskRequestSchema);
    if (!body.ok) return respondValidationError(c, body.error);

    return respondOk(
      c,
      await updateTask(
        { id: id.value, title: body.value.title },
        { tasks: deps.tasks, clock: deps.clock },
      ),
    );
  });

  router.post('/:id/complete', async (c) => {
    const id = parseIdParam(c);
    if (!id.ok) return respondValidationError(c, id.error);

    return respondOk(
      c,
      await completeTask({ id: id.value }, { tasks: deps.tasks, clock: deps.clock }),
    );
  });

  router.post('/:id/reopen', async (c) => {
    const id = parseIdParam(c);
    if (!id.ok) return respondValidationError(c, id.error);

    return respondOk(
      c,
      await reopenTask({ id: id.value }, { tasks: deps.tasks, clock: deps.clock }),
    );
  });

  router.delete('/:id', async (c) => {
    const id = parseIdParam(c);
    if (!id.ok) return respondValidationError(c, id.error);

    return respondNoContent(c, await deleteTask({ id: id.value }, { tasks: deps.tasks }));
  });

  return router;
};
