import { type UseMutationResult, useMutation, useQueryClient } from '@tanstack/react-query';
import type { ApiClientErrorException } from '../../domain/api-error.ts';
import { useTasksApi } from '../api-context.tsx';
import {
  cancelAndSnapshotList,
  invalidateList,
  type ListSnapshot,
  rollbackList,
  unwrap,
  writeOptimisticList,
} from './mutation-helpers.ts';
import { useNotifyMutationError } from './use-notify-mutation-error.ts';

interface Vars {
  readonly id: string;
}

interface Context {
  readonly previous: ListSnapshot;
}

export const useDeleteTaskMutation = (): UseMutationResult<void, ApiClientErrorException, Vars> => {
  const tasksApi = useTasksApi();
  const queryClient = useQueryClient();
  const notifyError = useNotifyMutationError();

  return useMutation<void, ApiClientErrorException, Vars, Context>({
    mutationFn: async ({ id }) => {
      unwrap(await tasksApi.remove(id));
    },
    onMutate: async ({ id }) => {
      const { previous } = await cancelAndSnapshotList(queryClient);
      writeOptimisticList(queryClient, (current) => current.filter((task) => task.id !== id));
      return { previous };
    },
    onError: (exception, _vars, ctx) => {
      rollbackList(queryClient, ctx);
      notifyError(exception);
    },
    onSettled: () => invalidateList(queryClient),
  });
};
