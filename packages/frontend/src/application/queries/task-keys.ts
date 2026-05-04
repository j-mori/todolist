/**
 * QueryKey factory for task-related TanStack Query caches. Centralised so
 * Session 5 mutations can target consistent keys for invalidation.
 */
export const taskKeys = {
  all: ['tasks'] as const,
  list: () => [...taskKeys.all, 'list'] as const,
} as const;

export type TaskListQueryKey = ReturnType<typeof taskKeys.list>;
