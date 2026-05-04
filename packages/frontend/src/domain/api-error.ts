/**
 * Adapter-level error vocabulary for the FE HTTP client. Superset of the wire
 * `ApiError` from `@todolist/shared`: adds `NetworkError` (fetch rejection) and
 * `ContractViolation` (response failed schema parse). See ADR-0025.
 */
export type ApiClientError =
  | {
      readonly kind: 'ValidationError';
      readonly field: string;
      readonly reason: string;
      readonly status: 400;
      readonly requestId: string;
    }
  | {
      readonly kind: 'TaskNotFound';
      readonly id: string;
      readonly status: 404;
      readonly requestId: string;
    }
  | {
      readonly kind: 'InternalError';
      readonly status: number;
      readonly requestId: string;
    }
  | {
      readonly kind: 'NetworkError';
      readonly cause: unknown;
      readonly requestId: string;
    }
  | {
      readonly kind: 'ContractViolation';
      readonly details: string;
      readonly requestId: string;
    };

export type ApiClientErrorKind = ApiClientError['kind'];

export class ApiClientErrorException extends Error {
  constructor(public readonly error: ApiClientError) {
    super(`${error.kind} (requestId=${error.requestId})`);
    this.name = 'ApiClientErrorException';
  }
}

export const isApiClientError = (value: unknown): value is ApiClientError => {
  if (typeof value !== 'object' || value === null) return false;
  const candidate = value as { kind?: unknown; requestId?: unknown };
  return typeof candidate.kind === 'string' && typeof candidate.requestId === 'string';
};
