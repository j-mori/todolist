import { type UseQueryResult, useQuery } from '@tanstack/react-query';
import type { TaskList } from '@todolist/shared';
import { ApiClientErrorException } from '../../domain/api-error.ts';
import { useTasksApi } from '../api-context.tsx';
import { taskKeys } from './task-keys.ts';

export const useTasksQuery = (): UseQueryResult<TaskList, ApiClientErrorException> => {
  const tasksApi = useTasksApi();
  return useQuery<TaskList, ApiClientErrorException>({
    queryKey: taskKeys.list(),
    queryFn: async ({ signal }) => {
      const result = await tasksApi.list({ signal });
      if (!result.ok) throw new ApiClientErrorException(result.error);
      return result.value;
    },
  });
};
