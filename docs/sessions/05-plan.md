# Session 5 — Frontend Features (plan)

## Context

Session 4 left a hexagonal FE foundation on `jacopo.mori/fe-foundations`: a typed `tasksApi.list()` returning `Result<TaskList, ApiClientError>`, a `useTasksQuery()` hook, a Tailwind v4 themed `<TaskList />` rendering loading / empty / populated / error, and a same-origin `/api` proxy in dev (Vite) and prod (nginx). 80 BE + 9 FE tests, lint + typecheck clean. ADRs 0023–0026 are pinned.

Session 5 fills in the UX. The brief's user-facing requirements live entirely on this single screen:

- **add** a new task (POST /tasks)
- **edit** the title of an existing task (PATCH /tasks/:id)
- **complete** a pending task and **reopen** a completed one (POST /tasks/:id/complete | /reopen — separate endpoints per ADR-0018)
- **delete** a task (DELETE /tasks/:id, returns 204)

Each interaction must be **optimistic with recoverable failure** (TanStack Query v5 onMutate/onError dance), **keyboard-driven** (Enter submits, Escape cancels, Space toggles complete), **announce-friendly** (errors land in a polite live region), and **reduced-motion safe**. The plan below is concrete enough to predict the file tree and the test surface before any code is written.

## Goals & non-goals

| In scope | Out of scope |
|---|---|
| Add / edit-title / complete / reopen / delete mutations | Routing — still single screen |
| Optimistic updates + rollback on server error | Undo affordance after a successful action (server confirmed = gone) |
| Inline edit (no separate page) | Drag-to-reorder, bulk actions, batch APIs |
| Keyboard support: Enter, Escape, Space (complete), Tab order, focus management on add/delete/edit | Custom keyboard shortcuts beyond the brief |
| Toast/notification system for failures (carries `requestId`) | A general design-system component library |
| Component tests per flow: happy + at least one failure | E2E (Session 6) |
| Tiny utility for mapping `ApiClientError` → human copy | Internationalisation (English-only is fine for the showcase) |
| One ADR if a real new convention emerges (notifications, mutation pattern); otherwise none | Editing ADRs 0023–0026 |

No new runtime deps. The brief's "no useless deps" still holds — TanStack Query gives us the mutation primitives; React + Tailwind give us everything else.

## Decisions to record

### D1 — Optimistic mutation pattern (uniform across all five hooks)

Every mutation uses the same TanStack Query v5 dance:

```ts
onMutate: async (vars) => {
  await queryClient.cancelQueries({ queryKey: taskKeys.list() });
  const previous = queryClient.getQueryData<TaskList>(taskKeys.list());
  queryClient.setQueryData<TaskList>(taskKeys.list(), (old) => applyOptimistic(old, vars));
  return { previous };           // context for rollback
},
onError: (error, vars, ctx) => {
  if (ctx?.previous) queryClient.setQueryData(taskKeys.list(), ctx.previous);
  notify.error(error);
},
onSettled: () => queryClient.invalidateQueries({ queryKey: taskKeys.list() }),
```

`applyOptimistic` is per-mutation — add prepends a synthetic task, edit/complete/reopen replace the matching item, delete filters it out. Because the BE returns `createdAt`-desc and we prepend on add, optimistic ordering matches server ordering at refetch.

Hooks throw the **raw** `ApiClientError` (not the wrapping Exception) from `mutationFn`, mirroring `useTasksQuery`. `mutation.error` is therefore typed `ApiClientError` end-to-end — same convention as Session 4 (handoff Open Question #1, decision deferred there: locking it in this session as the project standard).

For **add**, the optimistic task needs an `id` — generate via `crypto.randomUUID()`. The server-issued id replaces it on `onSettled` (refetch). React keys point to the optimistic id only briefly; once the refetch lands, keys reflect the real id.

Recorded as **ADR-0027**.

### D2 — Toasts: in-house `<NotificationsProvider>` + polite live region

A small, hand-rolled notifications layer:
- React context exposing `notify(notification)` and `dismiss(id)`.
- Reducer-backed queue.
- A `<NotificationsViewport>` component renders the queue with `role="region"` + `aria-live="polite"`, fixed bottom-right.
- Errors **do not auto-dismiss** (so users can copy the request id); successes dismiss after 4 s.
- Reduced-motion: skip the slide-in / fade-out transitions.

No deps. Two reasons:
1. The shape is small and known. `react-hot-toast`, `sonner` etc. carry portals, animation libs, and configuration we don't need.
2. The notifications carry the typed `ApiClientError` payload with `requestId` — easier to do natively than to coerce a generic toast lib's API.

A `formatApiClientError(error): { title, description?, requestId }` helper centralises the mapping — used by toasts and by the existing `<ErrorFallback>`.

Recorded as **ADR-0028**.

### D3 — Form validation: native HTML constraints + a thin trim/empty layer

The only form is "add task". The only field is `title`.

- HTML attributes carry the constraint: `required minLength={TASK_TITLE_MIN_LENGTH} maxLength={TASK_TITLE_MAX_LENGTH}` (constants from `@todolist/shared`).
- A small JS layer trims the value before submitting and rejects whitespace-only with an inline error (the BE rejects too, but client-side avoids the round trip and keeps the optimistic flow honest).
- No `react-hook-form`, no `formik`, no `zod-form-resolver`. One `<input>` does not justify a form library.
- Inline error appears `aria-describedby` the input, with `aria-invalid="true"` until corrected.

**Edit-mode** uses the same constraints — same component (`<TaskTitleInput />`) used by both `<AddTaskForm />` and `<TaskRow />` (in editing mode).

No ADR (too small; documented in the handoff under conventions).

### D4 — Inline edit with explicit Save / Cancel

A row enters edit mode on clicking an "Edit" button (mouse + keyboard). The row becomes a form with the input pre-populated and Save / Cancel buttons. Enter on the input saves; Escape cancels.

Why explicit buttons (not save-on-blur):
- Save-on-blur is hostile to keyboard users tabbing to other UI; a stray Tab silently commits.
- Buttons are discoverable (visible affordance), accessible (correct semantics), and testable (`getByRole('button', {name:/save/i})`).

Focus management:
- Entering edit mode → input is focused, value is selected.
- Save → focus returns to the row's "Edit" button.
- Cancel → focus returns to the row's "Edit" button.

No ADR.

### D5 — Status as checkbox (not badge); completed rows use strike-through + muted colour

Replace `<TaskStatusBadge />` with a native checkbox per row. The checkbox's `checked` mirrors `task.status === 'completed'`. Toggling fires `complete` or `reopen` (whichever moves to the new state). Strike-through + muted text for completed titles.

This change forces an update to one Session 4 test (`<TaskList />` populated test asserted badge text). The replacement assertion uses `aria-checked` / `checked` on the checkbox — a more honest test of the user-perceptible status signal.

`<TaskStatusBadge />` is deleted (dead code).

No ADR.

### D6 — Focus targets after each action

| Action | Where focus lands |
|---|---|
| Add submit (success) | the title `<input>` (cleared) — keep typing |
| Add submit (failure) | the title `<input>` with current text preserved |
| Complete / reopen | stays on the checkbox (browser default) |
| Edit "Edit" pressed | the title `<input>` with text selected |
| Edit Save / Cancel | the row's "Edit" button |
| Delete (success) | next sibling row's "Delete" button; if none, the add-task input |
| Delete (failure — row reappears) | the same row's "Delete" button |

Documented in the handoff for Session 6 to assert in E2E.

### D7 — Out of scope, recorded so they don't sneak in

- **Undo affordance** on the success toast (would require keeping the deleted task's full state and re-POSTing — ADR-0018's contract preserves identity but we'd be reconstructing across two requests).
- **Confirm-delete dialog** — optimistic delete + recoverable error toast covers the "I clicked the wrong button" case via the BE error envelope.
- **Animated reorder when add lands** — micro-animation candidate; deferring to Session 7 polish.

## File tree (predicted)

```
packages/frontend/src/
  adapters/
    api/
      tasks-api.ts                          # MODIFIED — add() / updateTitle() / complete() / reopen() / remove()

  application/
    notifications/
      notifications-context.tsx             # NEW — Provider + useNotifications hook + reducer
      format-api-client-error.ts            # NEW — ApiClientError → { title, description, requestId }
    queries/
      use-add-task-mutation.ts              # NEW
      use-update-title-mutation.ts          # NEW
      use-complete-task-mutation.ts         # NEW
      use-reopen-task-mutation.ts           # NEW
      use-delete-task-mutation.ts           # NEW
      mutation-helpers.ts                   # NEW — small shared helpers (cancel + snapshot, rollback)

  ui/
    main.tsx                                # (existing, MODIFIED) — wrap in NotificationsProvider
    AppShell.tsx                            # MODIFIED — render <NotificationsViewport />
    TaskList.tsx                            # MODIFIED — host <AddTaskForm /> above the list; pass mutation handlers to <TaskRow />
    TaskList.test.tsx                       # MODIFIED — populated test uses aria-checked, not badge text; +1 test for delete-focus
    TaskRow.tsx                             # MODIFIED — interactive: checkbox + edit + delete; internal `editing` state
    TaskRow.test.tsx                        # NEW — complete/reopen/edit/delete (happy + failure each)
    AddTaskForm.tsx                         # NEW — input + submit, native HTML constraints + trim
    AddTaskForm.test.tsx                    # NEW — happy + failure (validation + server)
    TaskTitleInput.tsx                      # NEW — shared <input> with required/maxLength + aria + trim helper export
    NotificationsViewport.tsx               # NEW — fixed-position polite region, renders cards
    NotificationCard.tsx                    # NEW — single notification with dismiss
    NotificationsViewport.test.tsx          # NEW — render + dismiss
    TaskStatusBadge.tsx                     # DELETED — superseded by checkbox
    test-helpers.ts                         # NEW — shared `renderApp(opts)` for component tests, swallowing duplication

docs/
  decisions/
    0027-frontend-mutation-pattern.md       # NEW — optimistic + rollback + invalidate
    0028-frontend-notifications.md          # NEW — in-house toast system
    README.md                                # MODIFIED — adds 0027, 0028
  sessions/
    05-plan.md                              # this file (already in flight)

CLAUDE.md                                   # MODIFIED — FE layout block notes new dirs (notifications/, queries/ mutations)
```

No new runtime deps. `package.json` files untouched.

## Hexagonal layering reminder

| Layer | New responsibilities this session |
|---|---|
| `domain/` | unchanged — `Result`, `ApiClientError` already cover everything mutations need |
| `application/` | mutation hooks (`use-*-mutation.ts`), notifications context |
| `adapters/api/` | extend `tasksApi` with the four mutation methods |
| `ui/` | add form, row interaction, toasts viewport |

`application/` still does not import from `adapters/`. Hooks call `useTasksApi()` (already in place from Session 4) — context wires the concrete adapter at `main.tsx`.

## Pinned signatures (frozen for Session 6)

```ts
// adapters/api/tasks-api.ts
export interface TasksApi {
  list(): Promise<Result<TaskList, ApiClientError>>;
  add(req: AddTaskRequest): Promise<Result<Task, ApiClientError>>;
  updateTitle(id: string, req: UpdateTaskRequest): Promise<Result<Task, ApiClientError>>;
  complete(id: string): Promise<Result<Task, ApiClientError>>;
  reopen(id: string): Promise<Result<Task, ApiClientError>>;
  remove(id: string): Promise<Result<void, ApiClientError>>;     // DELETE → 204; responseSchema = z.void()
}
```

```ts
// application/queries/use-add-task-mutation.ts (and the four siblings, mutatis mutandis)
export const useAddTaskMutation =
  (): UseMutationResult<Task, ApiClientError, AddTaskRequest>;

export const useUpdateTitleMutation =
  (): UseMutationResult<Task, ApiClientError, { id: string; req: UpdateTaskRequest }>;

export const useCompleteTaskMutation =
  (): UseMutationResult<Task, ApiClientError, { id: string }>;

export const useReopenTaskMutation =
  (): UseMutationResult<Task, ApiClientError, { id: string }>;

export const useDeleteTaskMutation =
  (): UseMutationResult<void, ApiClientError, { id: string }>;
```

```ts
// application/notifications/notifications-context.tsx
export interface Notification {
  readonly id: string;
  readonly level: 'error' | 'success';
  readonly title: string;
  readonly description?: string;
  readonly requestId?: string;
}
export interface NotificationsApi {
  notify(input: Omit<Notification, 'id'>): string;   // returns id, idempotent within a render
  dismiss(id: string): void;
  clear(): void;
}
export const NotificationsProvider: (props: { children: ReactNode }) => JSX.Element;
export const useNotifications: () => NotificationsApi;
export const useNotificationsState: () => readonly Notification[];   // for the viewport
```

```ts
// application/notifications/format-api-client-error.ts
export const formatApiClientError =
  (error: ApiClientError): { title: string; description?: string; requestId: string };
```

## Composition root delta (`main.tsx`)

```tsx
<StrictMode>
  <ErrorBoundary>
    <TasksApiProvider value={tasksApi}>
      <QueryClientProvider client={queryClient}>
        <NotificationsProvider>
          <App />
        </NotificationsProvider>
      </QueryClientProvider>
    </TasksApiProvider>
  </ErrorBoundary>
</StrictMode>
```

`<AppShell />` mounts `<NotificationsViewport />` inside its layout so toasts are visible on every render.

## UX copy (locked in plan; tests pin these)

- Add input placeholder: `Add a new task`
- Add submit button: `Add task`
- Inline validation error (whitespace title): `Title can't be empty.`
- Edit button label: `Edit`
- Save / Cancel labels: `Save`, `Cancel`
- Delete button label: `Delete`
- Toast titles:
  - validation: `Couldn't save your change` + description from `error.reason`
  - not-found: `That task no longer exists` + description: `It was deleted somewhere else. The list has been refreshed.`
  - internal: `Something went wrong on our end` + the request id
  - network: `Couldn't reach the server` + retry suggestion
  - contract violation: `Unexpected response from the server` + the request id
- Empty state stays unchanged ("No tasks yet" + "Tasks will appear here once they're created.")

## Test plan (by behaviour, mocking at the `fetch` boundary)

A `renderApp({ fetchSequence })` helper builds the full provider tree (Notifications + TasksApi + QueryClient with `retry: false`) and returns Testing-Library render utilities + a `notifications` accessor and a `flushFetches` helper.

**`AddTaskForm.test.tsx`**
- *adds a task and prepends it to the list* (happy)
- *clears and refocuses the input after a successful add* (happy, focus assertion)
- *shows an inline validation error and does not call the API for whitespace-only titles* (happy-path-of-failure: client-side guard)
- *rolls back the optimistic insert and surfaces an error toast on a 400 ValidationError* (failure)

**`TaskRow.test.tsx`**
- *toggling the checkbox completes a pending task optimistically* (happy)
- *Space on the focused checkbox completes the task* (keyboard-coverage variant)
- *toggling the checkbox reopens a completed task* (happy)
- *reverts to pending and surfaces a toast when the complete request 500s* (failure)
- *editing a title saves on Enter and updates the row* (happy)
- *editing reverts and closes on Escape without contacting the server* (happy + behavioural — mock `fetchImpl` is asserted not-called)
- *reverts the title and toasts on a 404 from the server during edit* (failure)
- *deleting removes the row optimistically* (happy)
- *moves focus to the next row's Delete button after a successful delete* (focus-management assertion)
- *re-renders the row and toasts when delete 500s* (failure)

**`TaskList.test.tsx`** (existing + delta)
- (kept) loading / empty / error
- (modified) populated: assert `<input type="checkbox" checked>` matches each task's status (no badge text)

**`NotificationsViewport.test.tsx`**
- *renders queued notifications and removes them when their dismiss button is pressed*
- *successful notifications auto-dismiss after their TTL expires* (uses `vi.useFakeTimers()`)

`HttpClient` test (Session 4) stays — no changes.

Targeted total: ~17 FE tests (was 9). Each test fails if the user-perceived behaviour breaks; none rely on TanStack Query internals or notification implementation details.

## Verification (definition of done)

```bash
cd /Users/jacopo.mori/Sites/todolist
npm run check                                          # lint + typecheck + 80 BE + 17 FE tests, green

# Dev workflow — full UX
PORT=3000 DATABASE_PATH=/tmp/todolist-smoke.db CORS_ORIGIN=http://localhost:5173 \
  NODE_ENV=development npm run dev --workspace @todolist/backend &
npm run dev --workspace @todolist/frontend
# In a browser at http://localhost:5173:
#   - Add "buy milk" → row appears at top, input cleared & focused.
#   - Click checkbox → strike-through, status flipped.
#   - Click Edit → input pre-filled, focus on input. Type "buy bread", Enter → updated.
#   - Click Delete → row removed, focus moves to the next Delete button.
#   - Stop the BE process; click anything → error toast lands with a request id (or "couldn't reach the server").
#   - Restart the BE; toast persists, dismiss it manually.

# Keyboard-only smoke
#   - Tab from the input through the rows.
#   - Space on a checkbox toggles complete/reopen.
#   - Enter in the input adds a task.
#   - Escape in the edit input cancels.

# Reduced motion smoke
#   System Preferences → Accessibility → Reduce Motion → on. Reload. No transitions on toasts or rows.

# Docker stack
docker compose up --build -d
# repeat the above against http://localhost:8081
```

Done when:
- Every functional requirement in the brief reachable from the UI.
- A keyboard-only user completes every flow.
- `prefers-reduced-motion: reduce` removes all transitions.
- Component tests cover each flow's success + at least one failure.
- `npm run check` green; FE bundle still has no Node-only deps.

## Risks / open questions for the human

1. **Throwing the raw `ApiClientError` from `mutationFn`** mirrors `useTasksQuery` (Session 4 Open Question #1). Locking it in as the project standard via ADR-0027. Push back if you'd rather have an Error subclass and an unwrapping layer.
2. **Notifications scope.** Errors stick (no auto-dismiss); successes auto-dismiss after 4 s. We could also surface a brief success toast on add ("Task added.") — leaning **no**, the optimistic insert is its own confirmation. Flag if you want them.
3. **No confirm dialog on delete.** Optimistic delete + recoverable error toast covers the server-error case. The "I clicked the wrong button" case is uncovered — the brief frames the project as a personal todo list; this matches typical patterns. Flag if you want a confirm.
4. **`<TaskStatusBadge />` deletion.** Updates one Session-4 test. The new assertion (`<input type="checkbox" checked>`) is more honest. Confirm or push back.
5. **Toast portal.** Currently fixed-position, mounted in normal flow under `<AppShell />`. A `createPortal` to `document.body` would be more robust against z-index issues, but adds DOM-reach we don't need yet. Defer to Session 7 polish unless you want it now.
6. **No animations** at all from this session except the toast slide/fade (which is muted under reduced-motion). Optimistic row insertion / removal is instant. Considered animating — micro-animations on add/remove tend to be noise more than aid for a list of this density. Flag if you want them.

After approval, I will execute the file tree above and finish by writing `handoffs/05-handoff.md` with the user-journey list Session 6 needs as input.
