import {
  type AddTaskRequest,
  type Task,
  type TaskList,
  taskListSchema,
  taskSchema,
  type UpdateTaskRequest,
} from '@todolist/shared';
import { z } from 'zod';
import type { ApiClientError } from '../../domain/api-error.ts';
import type { Result } from '../../domain/result.ts';
import type { HttpClient } from './http-client.ts';

/**
 * Optional `signal` lets the caller (typically TanStack Query's `queryFn`)
 * abort an in-flight request when the consumer unmounts or supersedes it.
 */
export interface RequestOptions {
  readonly signal?: AbortSignal | undefined;
}

export interface TasksApi {
  list(options?: RequestOptions): Promise<Result<TaskList, ApiClientError>>;
  add(req: AddTaskRequest, options?: RequestOptions): Promise<Result<Task, ApiClientError>>;
  updateTitle(
    id: string,
    req: UpdateTaskRequest,
    options?: RequestOptions,
  ): Promise<Result<Task, ApiClientError>>;
  complete(id: string, options?: RequestOptions): Promise<Result<Task, ApiClientError>>;
  reopen(id: string, options?: RequestOptions): Promise<Result<Task, ApiClientError>>;
  remove(id: string, options?: RequestOptions): Promise<Result<void, ApiClientError>>;
}

const voidSchema = z.undefined();

export const createTasksApi = (http: HttpClient): TasksApi => ({
  list: (options) =>
    http.request({
      method: 'GET',
      path: '/tasks',
      responseSchema: taskListSchema,
      signal: options?.signal,
    }),
  add: (req, options) =>
    http.request({
      method: 'POST',
      path: '/tasks',
      body: req,
      responseSchema: taskSchema,
      signal: options?.signal,
    }),
  updateTitle: (id, req, options) =>
    http.request({
      method: 'PATCH',
      path: `/tasks/${encodeURIComponent(id)}`,
      body: req,
      responseSchema: taskSchema,
      signal: options?.signal,
    }),
  complete: (id, options) =>
    http.request({
      method: 'POST',
      path: `/tasks/${encodeURIComponent(id)}/complete`,
      responseSchema: taskSchema,
      signal: options?.signal,
    }),
  reopen: (id, options) =>
    http.request({
      method: 'POST',
      path: `/tasks/${encodeURIComponent(id)}/reopen`,
      responseSchema: taskSchema,
      signal: options?.signal,
    }),
  remove: (id, options) =>
    http.request({
      method: 'DELETE',
      path: `/tasks/${encodeURIComponent(id)}`,
      responseSchema: voidSchema,
      signal: options?.signal,
    }),
});
