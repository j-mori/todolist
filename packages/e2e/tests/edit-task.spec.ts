import { expect, test } from '../playwright/fixtures.ts';

test.describe('edit task', () => {
  test('Save updates the row in place and exits edit mode', async ({ apiClient, taskListPage }) => {
    await apiClient.seed(['draft post']);
    await taskListPage.goto();

    await taskListPage.editButton('draft post').click();
    const input = taskListPage.editInput();
    await expect(input).toBeFocused();

    await input.fill('publish post');
    await taskListPage.saveButton().click();

    await expect(taskListPage.row('publish post')).toBeVisible();
    await expect(taskListPage.editButton('publish post')).toBeVisible();
    await expect(taskListPage.editInput()).toHaveCount(0);
  });

  test('Escape cancels the edit and never sends a PATCH', async ({ apiClient, taskListPage, page }) => {
    await apiClient.seed(['original title']);
    await taskListPage.goto();

    let patchCount = 0;
    await page.route('**/api/tasks/*', (route, request) => {
      if (request.method() === 'PATCH') patchCount += 1;
      return route.continue();
    });

    await taskListPage.editButton('original title').click();
    const input = taskListPage.editInput();
    await expect(input).toBeFocused();
    await input.fill('throwaway change');
    await input.press('Escape');

    await expect(taskListPage.row('original title')).toBeVisible();
    await expect(taskListPage.editButton('original title')).toBeVisible();
    await expect(taskListPage.editInput()).toHaveCount(0);
    await expect.poll(() => patchCount).toBe(0);
  });
});
