import { type UseMutationResult, useMutation, useQueryClient } from '@tanstack/react-query';
import type { Task, UpdateTaskRequest } from '@todolist/shared';
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
  readonly req: UpdateTaskRequest;
}

interface Context {
  readonly previous: ListSnapshot;
}

export const useUpdateTitleMutation = (): UseMutationResult<
  Task,
  ApiClientErrorException,
  Vars
> => {
  const tasksApi = useTasksApi();
  const queryClient = useQueryClient();
  const notifyError = useNotifyMutationError();

  return useMutation<Task, ApiClientErrorException, Vars, Context>({
    mutationFn: async ({ id, req }) => unwrap(await tasksApi.updateTitle(id, req)),
    onMutate: async ({ id, req }) => {
      const { previous } = await cancelAndSnapshotList(queryClient);
      const trimmed = req.title.trim();
      const now = new Date().toISOString();
      writeOptimisticList(queryClient, (current) =>
        current.map((task) =>
          task.id === id ? { ...task, title: trimmed, updatedAt: now } : task,
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
