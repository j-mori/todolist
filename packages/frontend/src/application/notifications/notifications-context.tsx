import { createContext, type ReactNode, useCallback, useContext, useMemo, useReducer } from 'react';

export type NotificationLevel = 'error' | 'success';

export interface Notification {
  readonly id: string;
  readonly level: NotificationLevel;
  readonly title: string;
  readonly description?: string;
  readonly requestId?: string;
}

export type NotificationInput = Omit<Notification, 'id'>;

export interface NotificationsApi {
  notify(input: NotificationInput): string;
  dismiss(id: string): void;
  clear(): void;
}

type Action =
  | { type: 'add'; notification: Notification }
  | { type: 'dismiss'; id: string }
  | { type: 'clear' };

const reducer = (state: readonly Notification[], action: Action): readonly Notification[] => {
  switch (action.type) {
    case 'add':
      return [...state, action.notification];
    case 'dismiss':
      return state.filter((n) => n.id !== action.id);
    case 'clear':
      return [];
  }
};

const ApiContext = createContext<NotificationsApi | null>(null);
const StateContext = createContext<readonly Notification[] | null>(null);

const generateId = (): string => crypto.randomUUID();

export const NotificationsProvider = ({ children }: { children: ReactNode }) => {
  const [state, dispatch] = useReducer(reducer, [] as readonly Notification[]);

  const notify = useCallback((input: NotificationInput): string => {
    const id = generateId();
    dispatch({ type: 'add', notification: { id, ...input } });
    return id;
  }, []);

  const dismiss = useCallback((id: string) => dispatch({ type: 'dismiss', id }), []);
  const clear = useCallback(() => dispatch({ type: 'clear' }), []);

  const api = useMemo<NotificationsApi>(
    () => ({ notify, dismiss, clear }),
    [notify, dismiss, clear],
  );

  return (
    <ApiContext.Provider value={api}>
      <StateContext.Provider value={state}>{children}</StateContext.Provider>
    </ApiContext.Provider>
  );
};

export const useNotifications = (): NotificationsApi => {
  const value = useContext(ApiContext);
  if (value === null)
    throw new Error('useNotifications must be used inside <NotificationsProvider>');
  return value;
};

export const useNotificationsState = (): readonly Notification[] => {
  const value = useContext(StateContext);
  if (value === null)
    throw new Error('useNotificationsState must be used inside <NotificationsProvider>');
  return value;
};
