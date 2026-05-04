# ADR-0028: FE notifications — in-house provider, polite live region, errors persist with `requestId`

**Status:** accepted
**Date:** 2026-05-04
**Session:** 05

## Context
Session 5 ships five mutations. Each can fail visibly: 400 ValidationError, 404 TaskNotFound (concurrent delete elsewhere), 500 InternalError, fetch rejections, schema drift. The user-facing channel for these failures is a non-blocking notification surface ("toast"). It must:

- announce errors to assistive tech (polite live region);
- carry the `requestId` so users can quote it when reporting bugs;
- remain visible until dismissed for errors (so the id is copyable);
- auto-dismiss success messages;
- respect `prefers-reduced-motion`;
- not depend on a third-party library for what is essentially a state-managed list of strings rendered into a portal.

## Decision

**In-house notifications layer**, hexagonally placed under `application/notifications/`:

- `notifications-context.tsx` — React context built around a `useReducer`-backed queue of typed `Notification` records.
- `useNotifications()` exposes `{ notify, dismiss, clear }`. `notify` returns the assigned id (so callers can dismiss programmatically — used by tests).
- `useNotificationsState()` exposes the queue (used by `<NotificationsViewport />`).
- `format-api-client-error.ts` — pure function mapping `ApiClientError` → `{ title, description?, requestId }`. Single place for the error-copy table; consumed by both toasts and the existing `<ErrorFallback />`.
- `<NotificationsViewport />` — fixed-positioned region rendered through `createPortal` into `document.body` so z-index conflicts can't bury it. `role="region"` + `aria-live="polite"` so additions are announced. Renders one `<NotificationCard />` per entry.
- `<NotificationCard />` — pure presentation: title, optional description, optional `requestId` rendered inside `<code>`, dismiss button.

**Behaviour:**
- Errors persist (no auto-dismiss). Reason: the `requestId` must remain copyable, and a vanished error is invisible failure.
- Successes auto-dismiss after **4 s** (no setTimeout race: the timer is cleared in the effect cleanup if the component unmounts or the notification is dismissed manually first).
- Reduced-motion: inline `transition`s are suppressed via the global `theme.css` rule (ADR-0026); no per-card `prefers-reduced-motion` check needed.

**Composition root delta (`main.tsx`):**

```tsx
<NotificationsProvider>
  <App />
</NotificationsProvider>
```

The viewport is mounted by `<AppShell />` (so it's present on every render). Every mutation hook receives a `notify` reference from the context and surfaces server-side failures uniformly:

```ts
onError: (exception) => notify({ level: 'error', ...formatApiClientError(exception.error) });
```

## Consequences

- **Positive:** Zero deps. The toast layer is a few hundred lines, all readable in one sitting. The `formatApiClientError` mapping is the only place error copy lives — easy to audit and translate later. Errors persist with their `requestId`, so users can report them. Live-region announcements work out of the box. Portal placement avoids z-index entanglement.
- **Trade-off:** No animation library. Slide / fade transitions are basic CSS; no spring physics, no stack reordering animation. For the showcase the trade is fair — animations are polish, not function.
- **Follow-up:** If the surface grows to many simultaneous notifications, evaluate stack collapsing or a "you have N more" affordance. Defer to Session 7.

## Alternatives considered

- **`react-hot-toast` / `sonner`** — rejected. Both pull in animation libs, portal helpers, and configuration we'd ignore. The notification payload here is bespoke (`requestId`-bearing), and adapting a generic library is more code than writing the small one we need.
- **Global `<dialog>` element** — rejected. Modal blocking is the wrong UX for non-blocking errors.
- **Browser `Notification` API** — rejected. Requires permission and is a system-level surface; wrong tool for in-app feedback.
- **Skip toasts; inline errors per row** — rejected for failures that aren't row-scoped (network / contract violations). Inline + global is over-engineering; one global region covers everything coherently.
