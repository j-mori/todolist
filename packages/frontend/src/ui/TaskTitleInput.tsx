import { TASK_TITLE_MAX_LENGTH, TASK_TITLE_MIN_LENGTH } from '@todolist/shared';
import { type Ref, useId } from 'react';
import { cn } from './cn.ts';

interface Props {
  readonly value: string;
  readonly onChange: (value: string) => void;
  readonly ariaLabel: string;
  readonly placeholder?: string | undefined;
  readonly error?: string | undefined;
  readonly disabled?: boolean | undefined;
  readonly onKeyDown?: ((event: React.KeyboardEvent<HTMLInputElement>) => void) | undefined;
  readonly ref?: Ref<HTMLInputElement> | undefined;
}

export const TaskTitleInput = ({
  ref,
  value,
  onChange,
  ariaLabel,
  placeholder,
  error,
  disabled,
  onKeyDown,
}: Props) => {
  const errorId = useId();
  const hasError = error !== undefined;
  return (
    <span className="flex flex-1 flex-col gap-1">
      <input
        ref={ref}
        type="text"
        value={value}
        onChange={(event) => onChange(event.target.value)}
        onKeyDown={onKeyDown}
        placeholder={placeholder}
        aria-label={ariaLabel}
        aria-invalid={hasError ? true : undefined}
        aria-describedby={hasError ? errorId : undefined}
        required
        minLength={TASK_TITLE_MIN_LENGTH}
        maxLength={TASK_TITLE_MAX_LENGTH}
        disabled={disabled}
        className={cn(
          'w-full rounded-md border bg-surface px-3 py-2 text-base text-fg',
          hasError ? 'border-danger' : 'border-border',
        )}
      />
      {hasError ? (
        <span id={errorId} className="text-xs text-danger">
          {error}
        </span>
      ) : null}
    </span>
  );
};
