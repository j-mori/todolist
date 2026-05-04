import { Component, type ErrorInfo, type ReactNode } from 'react';
import { ApiClientErrorException } from '../domain/api-error.ts';
import { ErrorFallback } from './ErrorFallback.tsx';

interface State {
  readonly error: Error | null;
}

const requestIdFrom = (error: Error): string | undefined =>
  error instanceof ApiClientErrorException ? error.error.requestId : undefined;

export class ErrorBoundary extends Component<{ children: ReactNode }, State> {
  override state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  override componentDidCatch(error: Error, info: ErrorInfo): void {
    console.error('Unhandled error in React tree', error, info);
  }

  private readonly reset = () => this.setState({ error: null });

  override render(): ReactNode {
    if (this.state.error === null) return this.props.children;
    const requestId = requestIdFrom(this.state.error);
    return (
      <div className="mx-auto max-w-2xl px-6 py-12">
        <ErrorFallback
          title="Something went wrong"
          description="The page hit an unexpected error. Reload to try again."
          {...(requestId === undefined ? {} : { requestId })}
          onRetry={this.reset}
        />
      </div>
    );
  }
}
