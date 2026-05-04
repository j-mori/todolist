import { expect, test } from '../playwright/fixtures.ts';

test('app renders the empty state and the add-task form on first paint', async ({
  taskListPage,
  page,
}) => {
  await taskListPage.goto();

  await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
  await expect(taskListPage.emptyState).toBeVisible();
  await expect(taskListPage.addInput).toBeVisible();
  await expect(taskListPage.addButton).toBeVisible();
});
