import { useCallback } from 'react';
import type { ApiClientErrorException } from '../../domain/api-error.ts';
import { formatApiClientError } from '../notifications/format-api-client-error.ts';
import { useNotifications } from '../notifications/notifications-context.tsx';

/**
 * Hook that returns a stable callback for surfacing mutation errors as
 * notifications. Centralised here so every mutation hook calls one helper.
 */
export const useNotifyMutationError = () => {
  const { notify } = useNotifications();
  return useCallback(
    (exception: ApiClientErrorException) =>
      notify({ level: 'error', ...formatApiClientError(exception.error) }),
    [notify],
  );
};
