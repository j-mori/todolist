import type { ApiClientError } from '../../domain/api-error.ts';

export interface FormattedApiClientError {
  readonly title: string;
  readonly description?: string;
  readonly requestId: string;
}

export const formatApiClientError = (error: ApiClientError): FormattedApiClientError => {
  switch (error.kind) {
    case 'ValidationError':
      return {
        title: "Couldn't save your change",
        description: `${error.reason} (${error.field})`,
        requestId: error.requestId,
      };
    case 'TaskNotFound':
      return {
        title: 'That task no longer exists',
        description: 'It was deleted somewhere else. The list has been refreshed.',
        requestId: error.requestId,
      };
    case 'InternalError':
      return {
        title: 'Something went wrong on our end',
        description: 'Please try again in a moment.',
        requestId: error.requestId,
      };
    case 'NetworkError':
      return {
        title: "Couldn't reach the server",
        description: 'Check your connection and try again.',
        requestId: error.requestId,
      };
    case 'ContractViolation':
      return {
        title: 'Unexpected response from the server',
        description: error.details,
        requestId: error.requestId,
      };
  }
};
