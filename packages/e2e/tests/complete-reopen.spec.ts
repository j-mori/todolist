import { expect, test } from '../playwright/fixtures.ts';

test('mark a task complete; then reopen it — checkbox state and accessible name flip both ways', async ({
  apiClient,
  taskListPage,
  page,
}) => {
  await apiClient.seed(['ship the build']);
  await taskListPage.goto();

  const completeBox = taskListPage.checkboxFor('ship the build', 'completed');
  await expect(completeBox).not.toBeChecked();

  // Click and wait for the BE to confirm before issuing the next mutation —
  // otherwise the optimistic state and the in-flight POST race the next click.
  const completeResponse = page.waitForResponse(
    (res) => res.url().endsWith('/complete') && res.request().method() === 'POST',
  );
  await completeBox.click();
  await completeResponse;

  // The accessible name flips after the mutation lands.
  const reopenBox = taskListPage.checkboxFor('ship the build', 'pending');
  await expect(reopenBox).toBeChecked();

  // Title gets line-through.
  await expect(
    taskListPage.row('ship the build').locator('p[class*="line-through"]'),
  ).toBeVisible();

  const reopenResponse = page.waitForResponse(
    (res) => res.url().endsWith('/reopen') && res.request().method() === 'POST',
  );
  await reopenBox.click();
  await reopenResponse;

  await expect(taskListPage.checkboxFor('ship the build', 'completed')).not.toBeChecked();
});
