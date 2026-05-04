import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import type { ReactNode } from 'react';
import { describe, expect, it, vi } from 'vitest';
import {
  NotificationsProvider,
  useNotifications,
} from '../application/notifications/notifications-context.tsx';
import { NotificationsViewport } from './NotificationsViewport.tsx';

const Wrapper = ({ children }: { children: ReactNode }) => (
  <NotificationsProvider>
    <NotificationsViewport />
    {children}
  </NotificationsProvider>
);

const Trigger = ({ onReady }: { onReady: (api: ReturnType<typeof useNotifications>) => void }) => {
  const api = useNotifications();
  onReady(api);
  return null;
};

describe('<NotificationsViewport />', () => {
  it('renders queued notifications and removes them when their dismiss button is pressed', async () => {
    let api: ReturnType<typeof useNotifications> | undefined;
    render(
      <Wrapper>
        <Trigger onReady={(value) => (api = value)} />
      </Wrapper>,
    );

    api?.notify({
      level: 'error',
      title: 'Something failed',
      description: 'A test failure for the dismiss path',
      requestId: 'req-1',
    });

    expect(await screen.findByText('Something failed')).toBeInTheDocument();
    expect(screen.getByText('req-1')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: /dismiss notification/i }));

    await waitFor(() => expect(screen.queryByText('Something failed')).not.toBeInTheDocument());
  });

  it('auto-dismisses success notifications after their TTL elapses', () => {
    vi.useFakeTimers();
    try {
      let api: ReturnType<typeof useNotifications> | undefined;
      render(
        <Wrapper>
          <Trigger onReady={(value) => (api = value)} />
        </Wrapper>,
      );

      act(() => {
        api?.notify({ level: 'success', title: 'All good' });
      });

      expect(screen.getByText('All good')).toBeInTheDocument();

      act(() => {
        vi.advanceTimersByTime(4500);
      });

      expect(screen.queryByText('All good')).not.toBeInTheDocument();
    } finally {
      vi.useRealTimers();
    }
  });

  it('does not reset an in-flight TTL when an unrelated notification arrives', () => {
    vi.useFakeTimers();
    try {
      let api: ReturnType<typeof useNotifications> | undefined;
      render(
        <Wrapper>
          <Trigger onReady={(value) => (api = value)} />
        </Wrapper>,
      );

      // First success enters at t=0; should be dismissed at t=4000.
      act(() => {
        api?.notify({ level: 'success', title: 'first success' });
      });
      expect(screen.getByText('first success')).toBeInTheDocument();

      // At t=2000, an unrelated notification arrives.
      act(() => {
        vi.advanceTimersByTime(2000);
      });
      act(() => {
        api?.notify({ level: 'error', title: 'unrelated error' });
      });
      expect(screen.getByText('first success')).toBeInTheDocument();
      expect(screen.getByText('unrelated error')).toBeInTheDocument();

      // At t=4001 the first toast should be gone (its 4 s TTL elapsed at t=4000).
      // If the timer were reset by the unrelated notify, it would still be visible.
      act(() => {
        vi.advanceTimersByTime(2001);
      });

      expect(screen.queryByText('first success')).not.toBeInTheDocument();
      // The error toast is still visible — errors do not auto-dismiss.
      expect(screen.getByText('unrelated error')).toBeInTheDocument();
    } finally {
      vi.useRealTimers();
    }
  });
});
