import { test as base, expect, type APIRequestContext } from '@playwright/test';
import { type Task, taskListSchema, taskSchema } from '@todolist/shared';
import { TaskListPage } from './pages/task-list.page.ts';

export interface ApiClient {
  list(): Promise<Task[]>;
  add(title: string): Promise<Task>;
  remove(id: string): Promise<void>;
  clear(): Promise<void>;
  seed(titles: readonly string[]): Promise<Task[]>;
}

const buildApiClient = (request: APIRequestContext): ApiClient => {
  const list = async (): Promise<Task[]> => {
    const res = await request.get('/api/tasks');
    expect(res.status(), 'GET /api/tasks').toBe(200);
    return taskListSchema.parse(await res.json());
  };

  const add = async (title: string): Promise<Task> => {
    const res = await request.post('/api/tasks', { data: { title } });
    expect(res.status(), `POST /api/tasks (${title})`).toBe(201);
    return taskSchema.parse(await res.json());
  };

  const remove = async (id: string): Promise<void> => {
    const res = await request.delete(`/api/tasks/${id}`);
    expect(res.status(), `DELETE /api/tasks/${id}`).toBe(204);
  };

  const clear = async (): Promise<void> => {
    const tasks = await list();
    await Promise.all(tasks.map((task) => remove(task.id)));
  };

  const seed = async (titles: readonly string[]): Promise<Task[]> => {
    const created: Task[] = [];
    // Sequential so ordering is stable (the BE orders by createdAt DESC).
    for (const title of titles) {
      created.push(await add(title));
    }
    return created;
  };

  return { list, add, remove, clear, seed };
};

interface Fixtures {
  apiClient: ApiClient;
  // biome-ignore lint/suspicious/noConfusingVoidType: Playwright auto-fixtures with no value use `void` by convention.
  cleanDb: void;
  taskListPage: TaskListPage;
}

export const test = base.extend<Fixtures>({
  apiClient: async ({ request }, use) => {
    await use(buildApiClient(request));
  },
  // autoFixture: wipes the BE database before every test by listing + deleting.
  // O(n) on the existing list — kept tiny by per-test discipline.
  cleanDb: [
    async ({ apiClient }, use) => {
      await apiClient.clear();
      await use();
    },
    { auto: true },
  ],
  taskListPage: async ({ page }, use) => {
    await use(new TaskListPage(page));
  },
});

export { expect };
