import { type ApiError, errorResponseSchema } from '@todolist/shared';
import type { ZodType } from 'zod';
import type { ApiClientError } from '../../domain/api-error.ts';
import { err, ok, type Result } from '../../domain/result.ts';

export type HttpMethod = 'GET' | 'POST' | 'PATCH' | 'DELETE';

export interface HttpRequest<T> {
  readonly method: HttpMethod;
  readonly path: string;
  readonly body?: unknown;
  readonly responseSchema: ZodType<T>;
  readonly signal?: AbortSignal | undefined;
}

export interface HttpClient {
  request<T>(req: HttpRequest<T>): Promise<Result<T, ApiClientError>>;
}

export interface HttpClientOptions {
  readonly baseUrl: string;
  readonly generateRequestId?: () => string;
  readonly fetchImpl?: typeof fetch;
}

const REQUEST_ID_HEADER = 'X-Request-Id';

const defaultGenerateRequestId = (): string => crypto.randomUUID();

const joinUrl = (baseUrl: string, path: string): string => {
  if (path.startsWith('/')) return `${baseUrl.replace(/\/$/, '')}${path}`;
  return `${baseUrl.replace(/\/$/, '')}/${path}`;
};

const responseRequestId = (response: Response, fallback: string): string => {
  const header = response.headers.get(REQUEST_ID_HEADER);
  return header && header.length > 0 ? header : fallback;
};

const apiErrorToClientError = (
  apiError: ApiError,
  status: number,
  requestId: string,
): ApiClientError => {
  switch (apiError.kind) {
    case 'ValidationError':
      return {
        kind: 'ValidationError',
        field: apiError.field,
        reason: apiError.reason,
        status: 400,
        requestId,
      };
    case 'TaskNotFound':
      return { kind: 'TaskNotFound', id: apiError.id, status: 404, requestId };
    case 'InternalError':
      return { kind: 'InternalError', status, requestId: apiError.requestId || requestId };
  }
};

const contractViolation = (details: string, requestId: string): ApiClientError => ({
  kind: 'ContractViolation',
  details,
  requestId,
});

const networkError = (cause: unknown, requestId: string): ApiClientError => ({
  kind: 'NetworkError',
  cause,
  requestId,
});

const readJsonOrUndefined = async (response: Response): Promise<unknown> => {
  if (response.status === 204) return undefined;
  const text = await response.text();
  if (text.length === 0) return undefined;
  try {
    return JSON.parse(text);
  } catch (cause) {
    throw new SyntaxError(`response body is not valid JSON: ${(cause as Error).message}`);
  }
};

export const createHttpClient = (opts: HttpClientOptions): HttpClient => {
  const fetchImpl = opts.fetchImpl ?? globalThis.fetch.bind(globalThis);
  const generateRequestId = opts.generateRequestId ?? defaultGenerateRequestId;

  return {
    async request<T>(req: HttpRequest<T>): Promise<Result<T, ApiClientError>> {
      const requestId = generateRequestId();
      const headers = new Headers({
        accept: 'application/json',
        [REQUEST_ID_HEADER]: requestId,
      });
      const init: RequestInit = { method: req.method, headers };
      if (req.body !== undefined) {
        headers.set('content-type', 'application/json');
        init.body = JSON.stringify(req.body);
      }
      if (req.signal !== undefined) init.signal = req.signal;

      let response: Response;
      try {
        response = await fetchImpl(joinUrl(opts.baseUrl, req.path), init);
      } catch (cause) {
        return err(networkError(cause, requestId));
      }

      const echoed = responseRequestId(response, requestId);

      let payload: unknown;
      try {
        payload = await readJsonOrUndefined(response);
      } catch (cause) {
        return err(contractViolation((cause as Error).message, echoed));
      }

      if (!response.ok) {
        const parsed = errorResponseSchema.safeParse(payload);
        if (!parsed.success) {
          return err(
            contractViolation(
              `error envelope did not match schema (status=${response.status})`,
              echoed,
            ),
          );
        }
        return err(apiErrorToClientError(parsed.data.error, response.status, echoed));
      }

      const parsed = req.responseSchema.safeParse(payload);
      if (!parsed.success) {
        return err(
          contractViolation(
            `response body did not match schema (status=${response.status}): ${parsed.error.message}`,
            echoed,
          ),
        );
      }
      return ok(parsed.data);
    },
  };
};
