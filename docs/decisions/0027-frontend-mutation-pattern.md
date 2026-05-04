# ADR-0027: FE mutation pattern — TanStack Query optimistic updates, `Error`-subclass throws, typed `mutation.error`

**Status:** accepted
**Date:** 2026-05-04
**Session:** 05

## Context
Session 5 introduces five mutations (add / update title / complete / reopen / delete). Three things needed to be pinned uniformly across all of them and across the existing `useTasksQuery`:

1. **Optimistic update strategy.** Every mutation moves the cache *before* the server confirms; on error it rolls back; after settle it invalidates so the eventual refetch wins.
2. **Throw vocabulary.** Session 4 (handoff Open Question #1) shipped `useTasksQuery` throwing the **raw** `ApiClientError` tagged union from `queryFn` so `query.error` matched the typed contract. That works, but it violates the JS convention of throwing `Error` subclasses — losing stack traces, breaking source-map tooling, and making the cross-stack story inconsistent.
3. **Hook return type.** Components must read `mutation.error` / `query.error` as typed values without `as` casts.

## Decision

### Optimistic update pattern (all five mutations)

Standard TanStack Query v5 dance, applied uniformly:

```ts
useMutation({
  mutationFn: (vars) => unwrap(await tasksApi.<action>(vars)),    // throws ApiClientErrorException on Err
  onMutate: async (vars) => {
    await queryClient.cancelQueries({ queryKey: taskKeys.list() });
    const previous = queryClient.getQueryData<TaskList>(taskKeys.list());
    queryClient.setQueryData<TaskList>(taskKeys.list(), (old) =>
      applyOptimistic(old ?? [], vars),
    );
    return { previous, optimisticId };
  },
  onSuccess: (server, _vars, ctx) => {
    // Replace any synthetic id with the server's authoritative one before invalidate, so
    // React keys are stable across the upcoming refetch.
    queryClient.setQueryData<TaskList>(taskKeys.list(), (old) =>
      reconcile(old ?? [], ctx, server),
    );
  },
  onError: (error, _vars, ctx) => {
    if (ctx?.previous) queryClient.setQueryData(taskKeys.list(), ctx.previous);
    notify.error(error);
  },
  onSettled: () => queryClient.invalidateQueries({ queryKey: taskKeys.list() }),
});
```

`applyOptimistic` is per-mutation:
- **add**: prepend a synthetic `Task` (id from `crypto.randomUUID()`, `status: 'pending'`, timestamps `new Date().toISOString()`).
- **updateTitle / complete / reopen**: replace the matching item by id with the new field(s) and `updatedAt: new Date().toISOString()`.
- **delete**: filter out the matching item.

`reconcile` is a no-op for delete and a "swap synthetic id with the server-issued task" for add (no-op for the title/status mutations because the optimistic and server states already match by id).

The same `taskKeys.list()` query key is shared with the existing `useTasksQuery` (ADR-0023 era — Session 4). One query key, one cache, every mutation invalidates it.

### Throw vocabulary

`queryFn` and every `mutationFn` throw an **`ApiClientErrorException`** (real `Error` subclass) constructed from the unwrapped `Result`. The Exception carries the typed `ApiClientError` on `.error`. This:

- preserves stack traces (Sentry, source-maps, DevTools all happy);
- keeps the discriminated union typed and discoverable via `exception.error.kind`;
- avoids the JavaScript-foot-gun of throwing non-Error values (TC39 / ES guidance).

A small `unwrap` helper centralises the throw:

```ts
// application/queries/mutation-helpers.ts
export const unwrap = <T>(result: Result<T, ApiClientError>): T => {
  if (!result.ok) throw new ApiClientErrorException(result.error);
  return result.value;
};
```

The Session 4 `useTasksQuery` is updated in this session to the same shape (and Session 4's handoff Open Question #1 is closed).

### Hook return types

All hooks expose `ApiClientErrorException` as the error type:

```ts
useTasksQuery():        UseQueryResult<TaskList, ApiClientErrorException>;
useAddTaskMutation():   UseMutationResult<Task, ApiClientErrorException, AddTaskRequest>;
useUpdateTitleMutation():
  UseMutationResult<Task, ApiClientErrorException, { id: string; req: UpdateTaskRequest }>;
useCompleteTaskMutation():
  UseMutationResult<Task, ApiClientErrorException, { id: string }>;
useReopenTaskMutation():
  UseMutationResult<Task, ApiClientErrorException, { id: string }>;
useDeleteTaskMutation():
  UseMutationResult<void, ApiClientErrorException, { id: string }>;
```

Component code reads:
```ts
if (mutation.isError) {
  notify.error(mutation.error);              // mutation.error: ApiClientErrorException
  switch (mutation.error.error.kind) { ... } // .error: ApiClientError (typed union)
}
```

## Consequences

- **Positive:** One pattern across all hooks. Stack traces preserved. `mutation.error` is a real Error subclass for every JS toolchain that expects one. The optimistic + rollback + invalidate dance is explicit and consistent. Cache state and server state converge after every action.
- **Trade-off:** One extra `.error` traversal at the call site (`mutation.error.error.kind`). Acceptable — components already destructure on `mutation.isError`, so the indirection is local and obvious.
- **Follow-up:** `useOptimistic` from React 19 was considered as an alternative to TanStack Query's optimistic updates, but mixing the two state mechanisms would fork the cache. Not adopting unless a future session decides to migrate the entire data layer.

## Alternatives considered

- **Throw the raw `ApiClientError`** (Session 4's choice for `useTasksQuery`) — rejected here. It worked but violated the throw-an-Error convention. Cleaning it up was cheap and improves consistency.
- **Throw Exception, expose Exception, no unwrap** — adopted (this ADR).
- **Throw Exception, but wrap the hook result so `.error` is unwrapped automatically** — rejected. Would require casting through `UseQueryResult`'s discriminated union, defeating the typing the wrapper was supposed to give back.
- **`useOptimistic` (React 19)** — rejected as primary mechanism; would parallel TanStack Query's cache. Reconsider only if the project leaves TanStack Query for some reason.
- **Pessimistic mutations (no optimism)** — rejected. The brief asks for optimistic UX.
