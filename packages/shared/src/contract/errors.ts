import { z } from 'zod';

export const validationErrorSchema = z.object({
  kind: z.literal('ValidationError'),
  field: z.string(),
  reason: z.string(),
});

export const taskNotFoundErrorSchema = z.object({
  kind: z.literal('TaskNotFound'),
  id: z.string(),
});

export const internalErrorSchema = z.object({
  kind: z.literal('InternalError'),
  requestId: z.string(),
});

export const apiErrorSchema = z.discriminatedUnion('kind', [
  validationErrorSchema,
  taskNotFoundErrorSchema,
  internalErrorSchema,
]);

export const errorResponseSchema = z.object({
  error: apiErrorSchema,
});

export type ValidationErrorBody = z.infer<typeof validationErrorSchema>;
export type TaskNotFoundErrorBody = z.infer<typeof taskNotFoundErrorSchema>;
export type InternalErrorBody = z.infer<typeof internalErrorSchema>;
export type ApiError = z.infer<typeof apiErrorSchema>;
export type ErrorResponse = z.infer<typeof errorResponseSchema>;
