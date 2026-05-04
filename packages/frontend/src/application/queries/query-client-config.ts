import type { QueryClientConfig } from '@tanstack/react-query';

const SECONDS = 1000;
const MINUTES = 60 * SECONDS;

/**
 * Centralised TanStack Query defaults so the rationale lives next to the value.
 *
 * - `staleTime`: how long a cached value is considered "fresh"; while fresh,
 *   remounts and refocuses do not refetch.
 * - `gcTime`: how long inactive cache entries linger before garbage collection.
 * - `retry`: a single retry covers transient network blips; the BE returns
 *   deterministic errors that should not be retried beyond that.
 * - `refetchOnWindowFocus`: bring the list up-to-date when the user comes back.
 *
 * Mutations never auto-retry — every action is user-initiated and idempotent
 * actions on the BE (complete/reopen) make at-least-once safe; non-idempotent
 * actions (add) must not double-fire.
 */
export const QUERY_CLIENT_DEFAULTS: QueryClientConfig = {
  defaultOptions: {
    queries: {
      staleTime: 30 * SECONDS,
      gcTime: 5 * MINUTES,
      retry: 1,
      refetchOnWindowFocus: true,
    },
    mutations: {
      retry: false,
    },
  },
};
