import type { QueryClient } from '@tanstack/react-query';
import type { TaskList } from '@todolist/shared';
import { type ApiClientError, ApiClientErrorException } from '../../domain/api-error.ts';
import type { Result } from '../../domain/result.ts';
import { taskKeys } from './task-keys.ts';

/** Pure mutation helpers — no React, no hooks. The hook variant lives in
 *  `use-notify-mutation-error.ts`. */

export type ListSnapshot = TaskList | undefined;

export const unwrap = <T>(result: Result<T, ApiClientError>): T => {
  if (!result.ok) throw new ApiClientErrorException(result.error);
  return result.value;
};

export const cancelAndSnapshotList = async (
  queryClient: QueryClient,
): Promise<{ previous: ListSnapshot }> => {
  await queryClient.cancelQueries({ queryKey: taskKeys.list() });
  return { previous: queryClient.getQueryData<TaskList>(taskKeys.list()) };
};

export const writeOptimisticList = (
  queryClient: QueryClient,
  updater: (current: TaskList) => TaskList,
): void => {
  queryClient.setQueryData<TaskList>(taskKeys.list(), (old) => updater(old ?? []));
};

export const rollbackList = (
  queryClient: QueryClient,
  ctx: { previous: ListSnapshot } | undefined,
): void => {
  if (ctx?.previous !== undefined) queryClient.setQueryData(taskKeys.list(), ctx.previous);
};

export const invalidateList = (queryClient: QueryClient): Promise<void> =>
  queryClient.invalidateQueries({ queryKey: taskKeys.list() });
