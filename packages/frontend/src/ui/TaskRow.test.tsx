import { fireEvent, screen, waitFor, within } from '@testing-library/react';
import type { Task } from '@todolist/shared';
import { describe, expect, it } from 'vitest';
import { TaskList } from './TaskList.tsx';
import {
  buildFetch,
  errorEnvelope,
  jsonResponse,
  noBodyResponse,
  renderWithProviders,
  taskFixture,
} from './test-helpers.tsx';

const PENDING: Task = taskFixture({
  id: '11111111-1111-4111-8111-111111111111',
  title: 'pending task',
  status: 'pending',
});

const COMPLETED: Task = taskFixture({
  id: '22222222-2222-4222-8222-222222222222',
  title: 'completed task',
  status: 'completed',
  updatedAt: '2026-05-04T09:30:00.000Z',
});

const SECOND_PENDING: Task = taskFixture({
  id: '33333333-3333-4333-8333-333333333333',
  title: 'second pending task',
  status: 'pending',
  createdAt: '2026-05-04T08:00:00.000Z',
  updatedAt: '2026-05-04T08:00:00.000Z',
});

const SERVER_REQUEST_ID = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';

describe('<TaskRow /> behaviours (rendered through <TaskList />)', () => {
  it('toggles the checkbox to complete a pending task optimistically', async () => {
    const completed: Task = {
      ...PENDING,
      status: 'completed',
      updatedAt: '2026-05-04T12:00:00.000Z',
    };
    let getCount = 0;
    const fetchImpl = buildFetch([
      {
        method: 'GET',
        path: '/api/tasks',
        respond: () => {
          getCount += 1;
          return getCount === 1 ? jsonResponse(200, [PENDING]) : jsonResponse(200, [completed]);
        },
      },
      {
        method: 'POST',
        path: /\/api\/tasks\/[^/]+\/complete$/,
        respond: () => jsonResponse(200, completed),
      },
    ]);

    renderWithProviders(<TaskList />, fetchImpl);
    const checkbox = await screen.findByRole('checkbox', {
      name: /mark "pending task" as completed/i,
    });

    fireEvent.click(checkbox);

    await waitFor(() =>
      expect(
        screen.getByRole('checkbox', { name: /mark "pending task" as pending/i }),
      ).toBeChecked(),
    );
  });

  it('reverts and surfaces a notification when the complete request 500s', async () => {
    let getCount = 0;
    const fetchImpl = buildFetch([
      {
        method: 'GET',
        path: '/api/tasks',
        respond: () => {
          getCount += 1;
          return jsonResponse(200, [PENDING]);
        },
      },
      {
        method: 'POST',
        path: /\/api\/tasks\/[^/]+\/complete$/,
        respond: () =>
          errorEnvelope(
            500,
            { kind: 'InternalError', requestId: SERVER_REQUEST_ID },
            SERVER_REQUEST_ID,
          ),
      },
    ]);

    renderWithProviders(<TaskList />, fetchImpl);
    const checkbox = await screen.findByRole('checkbox', {
      name: /mark "pending task" as completed/i,
    });

    fireEvent.click(checkbox);

    await waitFor(() =>
      expect(
        screen.getByRole('checkbox', { name: /mark "pending task" as completed/i }),
      ).not.toBeChecked(),
    );

    const alert = await screen.findByRole('region', { name: /notifications/i });
    expect(within(alert).getByText(/something went wrong on our end/i)).toBeInTheDocument();
    expect(within(alert).getByText(SERVER_REQUEST_ID)).toBeInTheDocument();
    // Subsequent invalidation refetch.
    expect(getCount).toBeGreaterThan(0);
  });

  it('reopens a completed task when its checkbox is toggled', async () => {
    const reopened: Task = {
      ...COMPLETED,
      status: 'pending',
      updatedAt: '2026-05-04T12:00:00.000Z',
    };
    let getCount = 0;
    const fetchImpl = buildFetch([
      {
        method: 'GET',
        path: '/api/tasks',
        respond: () => {
          getCount += 1;
          return getCount === 1 ? jsonResponse(200, [COMPLETED]) : jsonResponse(200, [reopened]);
        },
      },
      {
        method: 'POST',
        path: /\/api\/tasks\/[^/]+\/reopen$/,
        respond: () => jsonResponse(200, reopened),
      },
    ]);

    renderWithProviders(<TaskList />, fetchImpl);

    fireEvent.click(
      await screen.findByRole('checkbox', { name: /mark "completed task" as pending/i }),
    );

    await waitFor(() =>
      expect(
        screen.getByRole('checkbox', { name: /mark "completed task" as completed/i }),
      ).not.toBeChecked(),
    );
  });

  it('saves an edited title on submit and updates the row', async () => {
    const updated: Task = { ...PENDING, title: 'edited', updatedAt: '2026-05-04T12:00:00.000Z' };
    let getCount = 0;
    const fetchImpl = buildFetch([
      {
        method: 'GET',
        path: '/api/tasks',
        respond: () => {
          getCount += 1;
          return getCount === 1 ? jsonResponse(200, [PENDING]) : jsonResponse(200, [updated]);
        },
      },
      {
        method: 'PATCH',
        path: /\/api\/tasks\/[^/]+$/,
        respond: () => jsonResponse(200, updated),
      },
    ]);

    renderWithProviders(<TaskList />, fetchImpl);

    fireEvent.click(await screen.findByRole('button', { name: /edit "pending task"/i }));

    const editInput = await screen.findByRole('textbox', { name: /edit task title/i });
    fireEvent.change(editInput, { target: { value: 'edited' } });
    fireEvent.click(screen.getByRole('button', { name: /save/i }));

    await waitFor(() => expect(screen.getByText('edited')).toBeInTheDocument());
    expect(screen.queryByRole('button', { name: /save/i })).not.toBeInTheDocument();
  });

  it('cancels an edit on Escape without contacting the server', async () => {
    let patches = 0;
    const fetchImpl = buildFetch([
      { method: 'GET', path: '/api/tasks', respond: () => jsonResponse(200, [PENDING]) },
      {
        method: 'PATCH',
        path: /\/api\/tasks\/[^/]+$/,
        respond: () => {
          patches += 1;
          return jsonResponse(200, PENDING);
        },
      },
    ]);

    renderWithProviders(<TaskList />, fetchImpl);

    fireEvent.click(await screen.findByRole('button', { name: /edit "pending task"/i }));
    const editInput = await screen.findByRole('textbox', { name: /edit task title/i });
    fireEvent.change(editInput, { target: { value: 'discarded' } });
    fireEvent.keyDown(editInput, { key: 'Escape' });

    await waitFor(() =>
      expect(screen.queryByRole('button', { name: /save/i })).not.toBeInTheDocument(),
    );
    expect(screen.getByText('pending task')).toBeInTheDocument();
    expect(patches).toBe(0);
  });

  it('reverts the title and surfaces a notification when the edit 404s', async () => {
    let getCount = 0;
    const fetchImpl = buildFetch([
      {
        method: 'GET',
        path: '/api/tasks',
        respond: () => {
          getCount += 1;
          // The optimistic update changes the title locally; the rollback restores
          // the original; the eventual refetch returns the unchanged seed.
          return jsonResponse(200, [PENDING]);
        },
      },
      {
        method: 'PATCH',
        path: /\/api\/tasks\/[^/]+$/,
        respond: () =>
          errorEnvelope(404, { kind: 'TaskNotFound', id: PENDING.id }, SERVER_REQUEST_ID),
      },
    ]);

    renderWithProviders(<TaskList />, fetchImpl);

    fireEvent.click(await screen.findByRole('button', { name: /edit "pending task"/i }));
    const editInput = await screen.findByRole('textbox', { name: /edit task title/i });
    fireEvent.change(editInput, { target: { value: 'edited' } });
    fireEvent.click(screen.getByRole('button', { name: /save/i }));

    const alert = await screen.findByRole('region', { name: /notifications/i });
    expect(within(alert).getByText(/that task no longer exists/i)).toBeInTheDocument();

    await waitFor(() => expect(screen.getByText('pending task')).toBeInTheDocument());
    expect(screen.queryByText('edited')).not.toBeInTheDocument();
    expect(getCount).toBeGreaterThanOrEqual(1);
  });

  it('removes a task optimistically when delete is clicked and moves focus to the next row', async () => {
    let getCount = 0;
    const fetchImpl = buildFetch([
      {
        method: 'GET',
        path: '/api/tasks',
        respond: () => {
          getCount += 1;
          return getCount === 1
            ? jsonResponse(200, [PENDING, SECOND_PENDING])
            : jsonResponse(200, [SECOND_PENDING]);
        },
      },
      {
        method: 'DELETE',
        path: /\/api\/tasks\/[^/]+$/,
        respond: () => noBodyResponse(204),
      },
    ]);

    renderWithProviders(<TaskList />, fetchImpl);

    const deleteButton = await screen.findByRole('button', { name: /delete "pending task"/i });
    fireEvent.click(deleteButton);

    await waitFor(() => expect(screen.queryByText('pending task')).not.toBeInTheDocument());
    await waitFor(() => {
      const next = screen.getByRole('button', { name: /delete "second pending task"/i });
      expect(next).toHaveFocus();
    });
  });

  it('re-renders the row and surfaces a notification when delete 500s', async () => {
    let getCount = 0;
    const fetchImpl = buildFetch([
      {
        method: 'GET',
        path: '/api/tasks',
        respond: () => {
          getCount += 1;
          return jsonResponse(200, [PENDING]);
        },
      },
      {
        method: 'DELETE',
        path: /\/api\/tasks\/[^/]+$/,
        respond: () =>
          errorEnvelope(
            500,
            { kind: 'InternalError', requestId: SERVER_REQUEST_ID },
            SERVER_REQUEST_ID,
          ),
      },
    ]);

    renderWithProviders(<TaskList />, fetchImpl);

    fireEvent.click(await screen.findByRole('button', { name: /delete "pending task"/i }));

    const alert = await screen.findByRole('region', { name: /notifications/i });
    expect(within(alert).getByText(/something went wrong on our end/i)).toBeInTheDocument();
    expect(within(alert).getByText(SERVER_REQUEST_ID)).toBeInTheDocument();

    // Row reappears after rollback.
    await waitFor(() => expect(screen.getByText('pending task')).toBeInTheDocument());
    expect(getCount).toBeGreaterThanOrEqual(1);
  });
});
