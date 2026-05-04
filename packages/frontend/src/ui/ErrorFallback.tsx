import type { ApiClientError } from '../domain/api-error.ts';

export interface ErrorFallbackProps {
  readonly title: string;
  readonly description?: string;
  readonly requestId?: string;
  readonly error?: ApiClientError;
  readonly onRetry?: () => void;
}

export const ErrorFallback = ({
  title,
  description,
  requestId,
  error,
  onRetry,
}: ErrorFallbackProps) => {
  const id = requestId ?? error?.requestId;
  return (
    <section
      role="alert"
      className="rounded-md border border-danger bg-danger-bg p-6 text-danger"
    >
      <h2 className="text-lg font-semibold">{title}</h2>
      {description ? <p className="mt-2 text-sm">{description}</p> : null}
      {id ? (
        <p className="mt-4 text-xs">
          Request ID: <code className="font-mono">{id}</code>
        </p>
      ) : null}
      {onRetry ? (
        <button
          type="button"
          onClick={onRetry}
          className="mt-4 inline-flex items-center rounded-sm bg-danger px-3 py-1.5 text-sm font-medium text-primary-fg"
        >
          Try again
        </button>
      ) : null}
    </section>
  );
};
