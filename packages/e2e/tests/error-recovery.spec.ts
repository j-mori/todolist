import { expect, test } from '../playwright/fixtures.ts';

test('a 500 on complete rolls the optimistic checkbox back and surfaces a request id', async ({
  apiClient,
  taskListPage,
  page,
}) => {
  await apiClient.seed(['fragile task']);
  await taskListPage.goto();

  // Inject a 500 with a well-formed error envelope so the FE can extract the
  // requestId and surface it in the toast.
  await page.route('**/api/tasks/*/complete', (route) =>
    route.fulfill({
      status: 500,
      contentType: 'application/json',
      headers: { 'X-Request-Id': 'req-injected-by-test' },
      body: JSON.stringify({
        error: { kind: 'InternalError', requestId: 'req-injected-by-test' },
      }),
    }),
  );

  const completeBox = taskListPage.checkboxFor('fragile task', 'completed');
  // Use click() instead of check() — check() retries on rollback, masking the test.
  await completeBox.click();

  // The mutation rolls back: the row stays as 'pending' and the checkbox
  // accessible name still reads "as completed".
  await expect(taskListPage.checkboxFor('fragile task', 'completed')).not.toBeChecked();

  // The toast carries the injected request id.
  await expect(taskListPage.toasts.getByText('req-injected-by-test')).toBeVisible();
});
