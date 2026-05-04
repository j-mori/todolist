import { TASK_TITLE_MIN_LENGTH } from '@todolist/shared';
import { useRef, useState } from 'react';
import { useAddTaskMutation } from '../application/queries/use-add-task-mutation.ts';
import { TaskTitleInput } from './TaskTitleInput.tsx';

const VALIDATION_EMPTY = "Title can't be empty.";

export const AddTaskForm = () => {
  const mutation = useAddTaskMutation();
  const inputRef = useRef<HTMLInputElement>(null);
  const [value, setValue] = useState('');
  const [validationError, setValidationError] = useState<string | undefined>(undefined);

  const handleChange = (next: string) => {
    setValue(next);
    if (validationError !== undefined) setValidationError(undefined);
  };

  const submit = () => {
    const trimmed = value.trim();
    if (trimmed.length < TASK_TITLE_MIN_LENGTH) {
      setValidationError(VALIDATION_EMPTY);
      return;
    }
    setValidationError(undefined);
    mutation.mutate(
      { title: trimmed },
      {
        onSuccess: () => {
          setValue('');
          inputRef.current?.focus();
        },
      },
    );
  };

  return (
    <form
      onSubmit={(event) => {
        event.preventDefault();
        submit();
      }}
      aria-label="Add task"
      className="mb-6 flex items-start gap-2"
    >
      <TaskTitleInput
        ref={inputRef}
        value={value}
        onChange={handleChange}
        ariaLabel="New task title"
        placeholder="Add a new task"
        error={validationError}
      />
      <button
        type="submit"
        disabled={mutation.isPending}
        className="shrink-0 rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-fg disabled:opacity-60"
      >
        {mutation.isPending ? 'Adding…' : 'Add task'}
      </button>
    </form>
  );
};
