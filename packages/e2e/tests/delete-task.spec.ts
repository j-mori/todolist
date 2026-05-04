import { expect, test } from '../playwright/fixtures.ts';

test('deleting a row removes it and moves focus to the next row’s Delete button', async ({
  apiClient,
  taskListPage,
}) => {
  // Seeded sequentially; the BE returns newest-first, so 'three' is on top.
  await apiClient.seed(['one', 'two', 'three']);
  await taskListPage.goto();

  // Delete the top row ('three'); focus should land on 'two' (the new top).
  await taskListPage.deleteButton('three').click();

  await expect(taskListPage.row('three')).toHaveCount(0);
  await expect(taskListPage.deleteButton('two')).toBeFocused();
});
