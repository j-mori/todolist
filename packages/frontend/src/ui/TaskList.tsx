import type { Task, TaskList as TaskListType } from '@todolist/shared';
import { useCallback, useEffect, useRef } from 'react';
import { useDeleteTaskMutation } from '../application/queries/use-delete-task-mutation.ts';
import { useTasksQuery } from '../application/queries/use-tasks-query.ts';
import type { ApiClientErrorException } from '../domain/api-error.ts';
import { AddTaskForm } from './AddTaskForm.tsx';
import { ErrorFallback } from './ErrorFallback.tsx';
import { LiveRegion } from './LiveRegion.tsx';
import { TaskRow } from './TaskRow.tsx';

const announce = (
  isLoading: boolean,
  isError: boolean,
  tasks: TaskListType | undefined,
): string => {
  if (isLoading) return 'Loading tasks';
  if (isError) return 'Could not load tasks';
  if (!tasks) return '';
  if (tasks.length === 0) return 'No tasks yet';
  return `${tasks.length} ${tasks.length === 1 ? 'task' : 'tasks'} loaded`;
};

const Loading = () => (
  <p
    role="status"
    className="rounded-md border border-border bg-surface px-4 py-6 text-sm text-fg-muted"
  >
    Loading tasks…
  </p>
);

const Empty = () => (
  <div className="rounded-md border border-border bg-surface px-4 py-10 text-center">
    <p className="text-base font-medium">No tasks yet</p>
    <p className="mt-1 text-sm text-fg-muted">Tasks will appear here once they're created.</p>
  </div>
);

const ErrorState = ({
  exception,
  onRetry,
}: {
  exception: ApiClientErrorException;
  onRetry: () => void;
}) => (
  <ErrorFallback
    title="Could not load tasks"
    description="The list of tasks could not be fetched from the server."
    error={exception.error}
    onRetry={onRetry}
  />
);

interface PendingDelete {
  readonly deletedId: string;
  readonly nextId: string | undefined;
}

const Populated = ({ tasks }: { tasks: TaskListType }) => {
  const deleteMutation = useDeleteTaskMutation();
  const deleteButtonRefs = useRef(new Map<string, HTMLButtonElement>());
  const pendingDeleteRef = useRef<PendingDelete | null>(null);

  const handleDelete = (task: Task) => {
    const index = tasks.findIndex((t) => t.id === task.id);
    const next = index >= 0 ? tasks[index + 1] : undefined;
    pendingDeleteRef.current = { deletedId: task.id, nextId: next?.id };
    deleteMutation.mutate({ id: task.id });
  };

  useEffect(() => {
    const pending = pendingDeleteRef.current;
    if (!pending) return;
    pendingDeleteRef.current = null;
    const refs = deleteButtonRefs.current;

    // Rollback path: the deleted row is back. Restore focus to its delete button.
    if (tasks.some((t) => t.id === pending.deletedId)) {
      requestAnimationFrame(() => refs.get(pending.deletedId)?.focus());
      return;
    }
    // Happy path: focus the next remaining row's delete button (or fall back to
    // <body> — the AddTaskForm input is in a sibling component, so we let the
    // user tab back if they want).
    const nextId = pending.nextId;
    if (nextId !== undefined) {
      requestAnimationFrame(() => refs.get(nextId)?.focus());
    }
  }, [tasks]);

  // Stable callback — reads the task id from the DOM element's data attribute
  // so its identity never changes across renders.
  const setDeleteButtonRef = useCallback((element: HTMLButtonElement | null) => {
    if (element === null) return;
    const id = element.dataset.taskId;
    if (id !== undefined) deleteButtonRefs.current.set(id, element);
  }, []);

  // Sweep ref entries for tasks that left the list.
  useEffect(() => {
    const liveIds = new Set(tasks.map((t) => t.id));
    const refs = deleteButtonRefs.current;
    for (const id of refs.keys()) {
      if (!liveIds.has(id)) refs.delete(id);
    }
  }, [tasks]);

  return (
    <ul aria-label="Tasks" className="flex flex-col gap-2">
      {tasks.map((task) => (
        <TaskRow
          key={task.id}
          task={task}
          onDeleteClick={handleDelete}
          deleteButtonRef={setDeleteButtonRef}
        />
      ))}
    </ul>
  );
};

export const TaskList = () => {
  const query = useTasksQuery();
  const announcement = announce(query.isPending, query.isError, query.data);

  return (
    <section aria-labelledby="task-list-heading">
      <LiveRegion message={announcement} />
      <h2 id="task-list-heading" className="sr-only">
        Your tasks
      </h2>
      <AddTaskForm />
      {query.isPending ? <Loading /> : null}
      {query.isError ? (
        <ErrorState exception={query.error} onRetry={() => void query.refetch()} />
      ) : null}
      {query.isSuccess && query.data.length === 0 ? <Empty /> : null}
      {query.isSuccess && query.data.length > 0 ? <Populated tasks={query.data} /> : null}
    </section>
  );
};
