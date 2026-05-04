import { type UseMutationResult, useMutation, useQueryClient } from '@tanstack/react-query';
import type { Task } from '@todolist/shared';
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

export const useReopenTaskMutation = (): UseMutationResult<Task, ApiClientErrorException, Vars> => {
  const tasksApi = useTasksApi();
  const queryClient = useQueryClient();
  const notifyError = useNotifyMutationError();

  return useMutation<Task, ApiClientErrorException, Vars, Context>({
    mutationFn: async ({ id }) => unwrap(await tasksApi.reopen(id)),
    onMutate: async ({ id }) => {
      const { previous } = await cancelAndSnapshotList(queryClient);
      const now = new Date().toISOString();
      writeOptimisticList(queryClient, (current) =>
        current.map((task) =>
          task.id === id ? { ...task, status: 'pending', updatedAt: now } : task,
        ),
      );
      return { previous };
    },
    onError: (exception, _vars, ctx) => {
      rollbackList(queryClient, ctx);
      notifyError(exception);
    },
    onSettled: () => invalidateList(queryClient),
  });
};
