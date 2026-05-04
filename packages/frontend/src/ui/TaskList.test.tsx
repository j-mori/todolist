import { screen, waitFor, within } from '@testing-library/react';
import type { Task } from '@todolist/shared';
import { describe, expect, it, vi } from 'vitest';
import { TaskList } from './TaskList.tsx';
import {
  buildFetch,
  errorEnvelope,
  type FetchImpl,
  jsonResponse,
  renderWithProviders,
  taskFixture,
} from './test-helpers.tsx';

const FIRST: Task = taskFixture({
  id: '11111111-1111-4111-8111-111111111111',
  title: 'first task',
  status: 'pending',
  createdAt: '2026-05-04T09:00:00.000Z',
  updatedAt: '2026-05-04T09:00:00.000Z',
});

const SECOND: Task = taskFixture({
  id: '22222222-2222-4222-8222-222222222222',
  title: 'second task',
  status: 'completed',
  createdAt: '2026-05-04T10:00:00.000Z',
  updatedAt: '2026-05-04T10:30:00.000Z',
});

const SERVER_REQUEST_ID = '99999999-9999-4999-8999-999999999999';

describe('<TaskList />', () => {
  it('announces a loading state before tasks arrive', () => {
    const fetchImpl = vi
      .fn<FetchImpl>()
      .mockReturnValue(new Promise<Response>(() => {}));
    renderWithProviders(<TaskList />, fetchImpl);

    const statuses = screen.getAllByRole('status');
    expect(statuses.some((node) => /loading tasks/i.test(node.textContent ?? ''))).toBe(true);
  });

  it('announces the empty state when the API returns no tasks', async () => {
    const fetchImpl = buildFetch([
      { method: 'GET', path: '/api/tasks', respond: () => jsonResponse(200, []) },
    ]);
    renderWithProviders(<TaskList />, fetchImpl);

    expect(
      await screen.findByText(/tasks will appear here once they're created/i),
    ).toBeInTheDocument();
    expect(screen.queryByRole('list', { name: /tasks/i })).not.toBeInTheDocument();
    await waitFor(() => {
      const statuses = screen.getAllByRole('status');
      expect(statuses.some((node) => /no tasks yet/i.test(node.textContent ?? ''))).toBe(true);
    });
  });

  it('renders the user’s tasks in the order the server returned them', async () => {
    // BE returns createdAt-descending: SECOND (newer) first, then FIRST.
    const fetchImpl = buildFetch([
      { method: 'GET', path: '/api/tasks', respond: () => jsonResponse(200, [SECOND, FIRST]) },
    ]);
    renderWithProviders(<TaskList />, fetchImpl);

    const list = await screen.findByRole('list', { name: /tasks/i });
    const [newest, oldest] = within(list).getAllByRole('listitem');
    if (!newest || !oldest) throw new Error('expected exactly two task rows');

    expect(within(newest).getByText('second task')).toBeInTheDocument();
    expect(within(oldest).getByText('first task')).toBeInTheDocument();
    // Status is exposed via the checkbox state, not a separate badge.
    expect(within(newest).getByRole('checkbox')).toBeChecked();
    expect(within(oldest).getByRole('checkbox')).not.toBeChecked();

    // Wire timestamps surface in <time datetime>.
    const times = list.querySelectorAll('time');
    expect(times[0]?.getAttribute('datetime')).toBe(SECOND.createdAt);
    expect(times[1]?.getAttribute('datetime')).toBe(FIRST.createdAt);
  });

  it('shows the error fallback with the server’s request id when the API 500s', async () => {
    const fetchImpl = buildFetch([
      {
        method: 'GET',
        path: '/api/tasks',
        respond: () =>
          errorEnvelope(
            500,
            { kind: 'InternalError', requestId: SERVER_REQUEST_ID },
            SERVER_REQUEST_ID,
          ),
      },
    ]);
    renderWithProviders(<TaskList />, fetchImpl);

    const alert = await screen.findByRole('alert');
    expect(within(alert).getByText(/could not load tasks/i)).toBeInTheDocument();
    expect(within(alert).getByText(SERVER_REQUEST_ID)).toBeInTheDocument();
    expect(within(alert).getByRole('button', { name: /try again/i })).toBeInTheDocument();
  });
});
