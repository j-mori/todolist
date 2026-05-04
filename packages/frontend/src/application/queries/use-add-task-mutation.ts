import { type UseMutationResult, useMutation, useQueryClient } from '@tanstack/react-query';
import type { AddTaskRequest, Task } from '@todolist/shared';
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

interface AddContext {
  readonly previous: ListSnapshot;
  readonly optimisticId: string;
}

export const useAddTaskMutation = (): UseMutationResult<
  Task,
  ApiClientErrorException,
  AddTaskRequest
> => {
  const tasksApi = useTasksApi();
  const queryClient = useQueryClient();
  const notifyError = useNotifyMutationError();

  return useMutation<Task, ApiClientErrorException, AddTaskRequest, AddContext>({
    mutationFn: async (req) => unwrap(await tasksApi.add(req)),
    onMutate: async (req) => {
      const { previous } = await cancelAndSnapshotList(queryClient);
      const optimisticId = crypto.randomUUID();
      const now = new Date().toISOString();
      const optimistic: Task = {
        id: optimisticId,
        title: req.title.trim(),
        status: 'pending',
        createdAt: now,
        updatedAt: now,
      };
      writeOptimisticList(queryClient, (current) => [optimistic, ...current]);
      return { previous, optimisticId };
    },
    onSuccess: (server, _vars, ctx) => {
      writeOptimisticList(queryClient, (current) =>
        current.map((task) => (task.id === ctx.optimisticId ? server : task)),
      );
    },
    onError: (exception, _vars, ctx) => {
      rollbackList(queryClient, ctx);
      notifyError(exception);
    },
    onSettled: () => invalidateList(queryClient),
  });
};
