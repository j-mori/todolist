import { TASK_TITLE_MAX_LENGTH } from '@todolist/shared';
import { expect, test } from '../playwright/fixtures.ts';

test.describe('add task', () => {
  test('add via Enter key prepends the row, clears the input and refocuses it', async ({
    taskListPage,
  }) => {
    await taskListPage.goto();

    await taskListPage.addInput.fill('buy milk');
    await taskListPage.addInput.press('Enter');

    await expect(taskListPage.row('buy milk')).toBeVisible();
    await expect(taskListPage.addInput).toHaveValue('');
    await expect(taskListPage.addInput).toBeFocused();
  });

  test('add via the submit button creates the task', async ({ taskListPage }) => {
    await taskListPage.goto();

    await taskListPage.addInput.fill('walk the dog');
    await taskListPage.addButton.click();

    await expect(taskListPage.row('walk the dog')).toBeVisible();
  });

  test('whitespace-only title is blocked client-side; no request reaches the server', async ({
    taskListPage,
    page,
  }) => {
    await taskListPage.goto();

    let postCount = 0;
    await page.route('**/api/tasks', (route, request) => {
      if (request.method() === 'POST') postCount += 1;
      return route.continue();
    });

    await taskListPage.addInput.fill('   ');
    await taskListPage.addInput.press('Enter');

    await expect(taskListPage.addInput).toHaveAttribute('aria-invalid', 'true');
    await expect(page.getByText("Title can't be empty.")).toBeVisible();

    // Settle a tick to make sure no async POST got dispatched.
    await expect.poll(() => postCount).toBe(0);
  });

  test('title longer than the server allows is rejected with a toast carrying a request id', async ({
    taskListPage,
    page,
  }) => {
    await taskListPage.goto();

    // Bypass the input's maxLength attribute by setting the value directly,
    // then submit. The server's Zod schema must reject it with a 400.
    const tooLong = 'x'.repeat(TASK_TITLE_MAX_LENGTH + 1);
    await page.evaluate(
      ([selectorLabel, value]) => {
        const input = document.querySelector<HTMLInputElement>(
          `input[aria-label="${selectorLabel}"]`,
        );
        if (!input) throw new Error('add input missing');
        // React-friendly: use the native setter so the synthetic event sees the change.
        const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')?.set;
        setter?.call(input, value);
        input.dispatchEvent(new Event('input', { bubbles: true }));
      },
      ['New task title', tooLong] as const,
    );

    const responsePromise = page.waitForResponse(
      (response) =>
        response.url().endsWith('/api/tasks') &&
        response.request().method() === 'POST' &&
        response.status() === 400,
    );
    await taskListPage.addButton.click();
    await responsePromise;

    await expect(taskListPage.toasts.getByText(/request id/i)).toBeVisible();
    // The over-long row must NOT be on the page — the empty-state hero is.
    await expect(taskListPage.emptyState).toBeVisible();
  });
});
