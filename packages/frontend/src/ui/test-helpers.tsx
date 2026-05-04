import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { type RenderResult, render } from '@testing-library/react';
import type { Task } from '@todolist/shared';
import type { ReactElement, ReactNode } from 'react';
import { createHttpClient } from '../adapters/api/http-client.ts';
import { createTasksApi } from '../adapters/api/tasks-api.ts';
import { TasksApiProvider } from '../application/api-context.tsx';
import { NotificationsProvider } from '../application/notifications/notifications-context.tsx';
import { NotificationsViewport } from './NotificationsViewport.tsx';

export const FIXED_REQUEST_ID = 'client-request-id';

/** Re-export so tests can declare typed fetch impls without redefining the alias. */
export type FetchImpl = typeof fetch;

interface RouteOptions {
  readonly method: string;
  readonly path: RegExp | string;
  readonly respond: (request: Request) => Response | Promise<Response>;
}

const toRequest = (input: RequestInfo | URL, init?: RequestInit): Request =>
  input instanceof Request ? new Request(input, init) : new Request(input.toString(), init);

/**
 * Build a `fetch`-compatible mock that routes by method + path. The first
 * matching route wins; an unmatched call throws (loud, easy to debug).
 */
export const buildFetch = (routes: readonly RouteOptions[]): FetchImpl => {
  const impl: FetchImpl = (input, init) => {
    const request = toRequest(input, init);
    const url = new URL(request.url, 'http://localhost');
    const matched = routes.find(
      (r) =>
        r.method === request.method &&
        (typeof r.path === 'string' ? r.path === url.pathname : r.path.test(url.pathname)),
    );
    if (!matched) {
      throw new Error(`No mock route matched ${request.method} ${url.pathname}`);
    }
    return Promise.resolve(matched.respond(request));
  };
  return impl;
};

export const jsonResponse = (
  status: number,
  body: unknown,
  headers?: Record<string, string>,
): Response =>
  new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json', ...headers },
  });

export const noBodyResponse = (status: number, headers?: Record<string, string>): Response =>
  new Response(null, { status, ...(headers ? { headers } : {}) });

export const errorEnvelope = (
  status: number,
  error: { kind: string; [k: string]: unknown },
  requestId: string,
): Response => jsonResponse(status, { error }, { 'x-request-id': requestId });

export const renderWithProviders = (ui: ReactElement, fetchImpl: FetchImpl): RenderResult => {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false, gcTime: 0, staleTime: 0 },
      mutations: { retry: false },
    },
  });
  const httpClient = createHttpClient({
    baseUrl: '/api',
    fetchImpl,
    generateRequestId: () => FIXED_REQUEST_ID,
  });
  const tasksApi = createTasksApi(httpClient);

  const Wrapper = ({ children }: { children: ReactNode }) => (
    <TasksApiProvider value={tasksApi}>
      <QueryClientProvider client={queryClient}>
        <NotificationsProvider>
          {children}
          <NotificationsViewport />
        </NotificationsProvider>
      </QueryClientProvider>
    </TasksApiProvider>
  );

  return render(ui, { wrapper: Wrapper });
};

export const taskFixture = (overrides: Partial<Task> = {}): Task => ({
  id: '11111111-1111-4111-8111-111111111111',
  title: 'sample',
  status: 'pending',
  createdAt: '2026-05-04T09:00:00.000Z',
  updatedAt: '2026-05-04T09:00:00.000Z',
  ...overrides,
});
