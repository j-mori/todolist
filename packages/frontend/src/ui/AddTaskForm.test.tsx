import { fireEvent, screen, waitFor, within } from '@testing-library/react';
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

const SEED_TASK = taskFixture({
  id: '11111111-1111-4111-8111-111111111111',
  title: 'existing',
  status: 'pending',
});

const ADDED_TASK = taskFixture({
  id: '22222222-2222-4222-8222-222222222222',
  title: 'new task',
  status: 'pending',
  createdAt: '2026-05-04T11:00:00.000Z',
  updatedAt: '2026-05-04T11:00:00.000Z',
});

const SERVER_REQUEST_ID = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';

const findInput = () => screen.getByRole('textbox', { name: /new task title/i });
const findSubmit = () => screen.getByRole('button', { name: /^add task$/i });

describe('<AddTaskForm /> (in <TaskList />)', () => {
  it('prepends a new task optimistically, clears the input, and refocuses it', async () => {
    let getCallCount = 0;
    const fetchImpl = buildFetch([
      {
        method: 'GET',
        path: '/api/tasks',
        respond: () => {
          getCallCount += 1;
          // First load: only the existing task. After invalidation: server has both.
          if (getCallCount === 1) return jsonResponse(200, [SEED_TASK]);
          return jsonResponse(200, [ADDED_TASK, SEED_TASK]);
        },
      },
      {
        method: 'POST',
        path: '/api/tasks',
        respond: () => jsonResponse(201, ADDED_TASK),
      },
    ]);
    renderWithProviders(<TaskList />, fetchImpl);

    // Wait for the initial list to render.
    await screen.findByText('existing');

    const input = findInput();
    fireEvent.change(input, { target: { value: 'new task' } });
    fireEvent.click(findSubmit());

    // Optimistically (and then via refetch) the new task is at the top.
    const list = await screen.findByRole('list', { name: /tasks/i });
    await waitFor(() => {
      const items = within(list).getAllByRole('listitem');
      expect(items[0]).toHaveTextContent('new task');
      expect(items[1]).toHaveTextContent('existing');
    });

    await waitFor(() => expect(findInput()).toHaveValue(''));
    await waitFor(() => expect(findInput()).toHaveFocus());
  });

  it('shows an inline validation error and does not call the API for a whitespace-only title', () => {
    const fetchImpl = vi.fn<FetchImpl>((input, init) => {
      const method = init?.method ?? 'GET';
      const url = input instanceof Request ? input.url : input.toString();
      // The very first call is the initial list. Any other call is unexpected.
      if (method === 'GET' && url.includes('/api/tasks')) {
        return Promise.resolve(jsonResponse(200, []));
      }
      throw new Error(`unexpected fetch ${method} ${url}`);
    });

    renderWithProviders(<TaskList />, fetchImpl);

    const input = findInput();
    fireEvent.change(input, { target: { value: '   ' } });
    fireEvent.click(findSubmit());

    expect(screen.getByText(/title can't be empty/i)).toBeInTheDocument();
    expect(input).toHaveAttribute('aria-invalid', 'true');
    // GET /tasks (1 call). No POST.
    expect(fetchImpl.mock.calls).toHaveLength(1);
  });

  it('rolls back the optimistic insert and surfaces an error notification when the server rejects', async () => {
    const fetchImpl = buildFetch([
      { method: 'GET', path: '/api/tasks', respond: () => jsonResponse(200, [SEED_TASK]) },
      {
        method: 'POST',
        path: '/api/tasks',
        respond: () =>
          errorEnvelope(
            400,
            { kind: 'ValidationError', field: 'title', reason: 'must not be empty' },
            SERVER_REQUEST_ID,
          ),
      },
    ]);
    renderWithProviders(<TaskList />, fetchImpl);

    await screen.findByText('existing');

    fireEvent.change(findInput(), { target: { value: 'new task' } });
    fireEvent.click(findSubmit());

    // Toast lands.
    const alert = await screen.findByRole('region', { name: /notifications/i });
    expect(within(alert).getByText(/couldn't save your change/i)).toBeInTheDocument();
    expect(within(alert).getByText(SERVER_REQUEST_ID)).toBeInTheDocument();

    // List is back to just the seed task — optimistic insert removed.
    await waitFor(() => {
      const list = screen.getByRole('list', { name: /tasks/i });
      expect(within(list).getAllByRole('listitem')).toHaveLength(1);
      expect(within(list).getByText('existing')).toBeInTheDocument();
      expect(within(list).queryByText('new task')).not.toBeInTheDocument();
    });
  });
});
