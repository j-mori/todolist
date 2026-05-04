import type { Task } from '@todolist/shared';
import { type KeyboardEvent, type Ref, useEffect, useRef, useState } from 'react';
import { formatTaskTimestamp } from '../application/formatting/format-task-timestamp.ts';
import { useCompleteTaskMutation } from '../application/queries/use-complete-task-mutation.ts';
import { useReopenTaskMutation } from '../application/queries/use-reopen-task-mutation.ts';
import { useUpdateTitleMutation } from '../application/queries/use-update-title-mutation.ts';
import { cn } from './cn.ts';
import { TaskTitleInput } from './TaskTitleInput.tsx';

interface TaskRowProps {
  readonly task: Task;
  readonly onDeleteClick: (task: Task) => void;
  readonly deleteButtonRef?: Ref<HTMLButtonElement>;
  readonly deleteDisabled?: boolean;
}

export const TaskRow = ({ task, onDeleteClick, deleteButtonRef, deleteDisabled }: TaskRowProps) => {
  const completeMutation = useCompleteTaskMutation();
  const reopenMutation = useReopenTaskMutation();
  const updateTitleMutation = useUpdateTitleMutation();
  const editButtonRef = useRef<HTMLButtonElement>(null);

  const [editing, setEditing] = useState(false);
  const [editValue, setEditValue] = useState(task.title);
  const editInputRef = useRef<HTMLInputElement>(null);

  // Reset draft when leaving edit mode (or when the underlying task is replaced
  // by a newer optimistic/server snapshot while we're not editing).
  useEffect(() => {
    if (!editing) setEditValue(task.title);
  }, [editing, task.title]);

  // Auto-focus + select all on entering edit mode.
  useEffect(() => {
    if (!editing) return;
    const input = editInputRef.current;
    if (!input) return;
    input.focus();
    input.select();
  }, [editing]);

  const handleToggleStatus = () => {
    if (task.status === 'pending') completeMutation.mutate({ id: task.id });
    else reopenMutation.mutate({ id: task.id });
  };

  const startEditing = () => setEditing(true);

  const stopEditing = (focusEditButton: boolean) => {
    setEditing(false);
    if (focusEditButton) {
      // Defer to after the next paint so the (now-rendered) edit button can take focus.
      requestAnimationFrame(() => editButtonRef.current?.focus());
    }
  };

  const handleSubmitEdit = () => {
    const trimmed = editValue.trim();
    if (trimmed.length === 0) {
      // Empty title — close edit mode without contacting the server (matches AddTaskForm behaviour).
      stopEditing(true);
      return;
    }
    if (trimmed === task.title) {
      stopEditing(true);
      return;
    }
    updateTitleMutation.mutate({ id: task.id, req: { title: trimmed } });
    stopEditing(true);
  };

  const handleEditKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key === 'Escape') {
      event.preventDefault();
      setEditValue(task.title);
      stopEditing(true);
    }
  };

  const isCompleted = task.status === 'completed';
  const checkboxLabel = `Mark "${task.title}" as ${isCompleted ? 'pending' : 'completed'}`;
  const editButtonLabel = `Edit "${task.title}"`;
  const deleteButtonLabel = `Delete "${task.title}"`;

  return (
    <li className="flex items-center gap-3 rounded-md border border-border bg-surface px-4 py-3">
      <input
        type="checkbox"
        checked={isCompleted}
        onChange={handleToggleStatus}
        aria-label={checkboxLabel}
        className="size-5 cursor-pointer"
      />

      {editing ? (
        <form
          aria-label={`Edit task ${task.title}`}
          onSubmit={(event) => {
            event.preventDefault();
            handleSubmitEdit();
          }}
          className="flex flex-1 items-center gap-2"
        >
          <TaskTitleInput
            ref={editInputRef}
            value={editValue}
            onChange={setEditValue}
            ariaLabel="Edit task title"
            onKeyDown={handleEditKeyDown}
          />
          <button
            type="submit"
            className="rounded-md bg-primary px-3 py-1.5 text-sm font-medium text-primary-fg"
          >
            Save
          </button>
          <button
            type="button"
            onClick={() => {
              setEditValue(task.title);
              stopEditing(true);
            }}
            className="rounded-md bg-surface-muted px-3 py-1.5 text-sm font-medium text-fg"
          >
            Cancel
          </button>
        </form>
      ) : (
        <div className="flex min-w-0 flex-1 items-center gap-3">
          <div className="min-w-0 flex-1">
            <p
              className={cn(
                'truncate text-base',
                isCompleted ? 'text-fg-muted line-through' : 'text-fg',
              )}
            >
              {task.title}
            </p>
            <p className="mt-0.5 text-xs text-fg-muted">
              Created <time dateTime={task.createdAt}>{formatTaskTimestamp(task.createdAt)}</time>
            </p>
          </div>
          <button
            ref={editButtonRef}
            type="button"
            onClick={startEditing}
            aria-label={editButtonLabel}
            className="shrink-0 rounded-md bg-surface-muted px-3 py-1.5 text-sm font-medium text-fg"
          >
            Edit
          </button>
          <button
            ref={deleteButtonRef}
            type="button"
            onClick={() => onDeleteClick(task)}
            disabled={deleteDisabled}
            aria-label={deleteButtonLabel}
            data-task-id={task.id}
            className="shrink-0 rounded-md bg-surface-muted px-3 py-1.5 text-sm font-medium text-danger disabled:opacity-50"
          >
            Delete
          </button>
        </div>
      )}
    </li>
  );
};
