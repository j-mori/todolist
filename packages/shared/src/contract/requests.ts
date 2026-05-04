import { z } from 'zod';

export const addTaskRequestSchema = z.object({
  title: z.string(),
});

export const updateTaskRequestSchema = z.object({
  title: z.string(),
});

export const taskIdParamSchema = z.object({
  id: z.uuid({ version: 'v4' }),
});

export type AddTaskRequest = z.infer<typeof addTaskRequestSchema>;
export type UpdateTaskRequest = z.infer<typeof updateTaskRequestSchema>;
export type TaskIdParam = z.infer<typeof taskIdParamSchema>;
