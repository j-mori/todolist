import { z } from 'zod';

/**
 * Wire-level constraints. These are the single source of truth across BE and FE.
 * The domain `TaskTitle` value object imports them to stay in lockstep.
 */
export const TASK_TITLE_MIN_LENGTH = 1;
export const TASK_TITLE_MAX_LENGTH = 200;

export const taskStatusSchema = z.enum(['pending', 'completed']);

export const taskSchema = z.object({
  id: z.uuid({ version: 'v4' }),
  title: z.string().min(TASK_TITLE_MIN_LENGTH).max(TASK_TITLE_MAX_LENGTH),
  status: taskStatusSchema,
  createdAt: z.iso.datetime(),
  updatedAt: z.iso.datetime(),
});

export const taskListSchema = z.array(taskSchema);

export type TaskStatus = z.infer<typeof taskStatusSchema>;
export type Task = z.infer<typeof taskSchema>;
export type TaskList = z.infer<typeof taskListSchema>;
