import type {
  Notification,
  NotificationLevel,
} from '../application/notifications/notifications-context.tsx';

const LEVEL_CLASSES: Record<NotificationLevel, string> = {
  error: 'bg-danger-bg text-danger',
  success: 'bg-success-bg text-success',
};

export const NotificationCard = ({
  notification,
  onDismiss,
}: {
  notification: Notification;
  onDismiss: (id: string) => void;
}) => (
  <article
    className={`pointer-events-auto rounded-md border border-current p-4 text-sm shadow-sm ${LEVEL_CLASSES[notification.level]}`}
  >
    <div className="flex items-start justify-between gap-3">
      <div className="min-w-0">
        <p className="font-semibold">{notification.title}</p>
        {notification.description ? (
          <p className="mt-1 text-fg">{notification.description}</p>
        ) : null}
        {notification.requestId ? (
          <p className="mt-2 text-xs text-fg-muted">
            Request ID: <code className="font-mono">{notification.requestId}</code>
          </p>
        ) : null}
      </div>
      <button
        type="button"
        onClick={() => onDismiss(notification.id)}
        aria-label="Dismiss notification"
        className="shrink-0 rounded-sm px-2 py-1 text-xs font-medium text-current"
      >
        ×
      </button>
    </div>
  </article>
);
