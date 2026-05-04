import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import {
  useNotifications,
  useNotificationsState,
} from '../application/notifications/notifications-context.tsx';
import { NotificationCard } from './NotificationCard.tsx';

const SUCCESS_TTL_MS = 4000;

/**
 * Auto-dismiss success notifications after `SUCCESS_TTL_MS`.
 *
 * Timers are tracked per-notification id so adding a new notification doesn't
 * reset the timers of existing ones (regression test:
 * "an unrelated queue change does not reset an in-flight TTL").
 */
const useAutoDismiss = () => {
  const notifications = useNotificationsState();
  const { dismiss } = useNotifications();
  const timers = useRef(new Map<string, ReturnType<typeof setTimeout>>());

  useEffect(() => {
    const liveIds = new Set(notifications.map((n) => n.id));

    // Drop timers for notifications that are no longer in the queue.
    for (const [id, timer] of timers.current) {
      if (!liveIds.has(id)) {
        clearTimeout(timer);
        timers.current.delete(id);
      }
    }

    // Schedule timers only for newly-arrived success notifications.
    for (const n of notifications) {
      if (n.level === 'success' && !timers.current.has(n.id)) {
        const id = n.id;
        timers.current.set(
          id,
          setTimeout(() => {
            timers.current.delete(id);
            dismiss(id);
          }, SUCCESS_TTL_MS),
        );
      }
    }
  }, [notifications, dismiss]);

  // Cleanup on unmount only.
  useEffect(
    () => () => {
      for (const t of timers.current.values()) clearTimeout(t);
      timers.current.clear();
    },
    [],
  );
};

export const NotificationsViewport = () => {
  const notifications = useNotificationsState();
  const { dismiss } = useNotifications();
  useAutoDismiss();

  // Render into document.body so z-index stacking can't bury the region.
  // Falls back to inline render until the document is available (SSR-safety
  // reflex; not strictly needed here but cheap).
  const [target, setTarget] = useState<HTMLElement | null>(null);
  useEffect(() => setTarget(document.body), []);

  const region = (
    <section
      aria-label="Notifications"
      aria-live="polite"
      className="pointer-events-none fixed inset-x-0 bottom-0 z-50 flex flex-col gap-2 p-4 sm:left-auto sm:right-0 sm:max-w-sm"
    >
      {notifications.map((notification) => (
        <NotificationCard key={notification.id} notification={notification} onDismiss={dismiss} />
      ))}
    </section>
  );

  return target ? createPortal(region, target) : region;
};
