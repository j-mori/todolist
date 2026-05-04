import type { Locator, Page } from '@playwright/test';

export class TaskListPage {
  readonly addInput: Locator;
  readonly addButton: Locator;
  readonly tasksList: Locator;
  readonly toasts: Locator;
  readonly emptyState: Locator;

  constructor(readonly page: Page) {
    this.addInput = page.getByRole('textbox', { name: 'New task title' });
    this.addButton = page.getByRole('button', { name: 'Add task' });
    this.tasksList = page.getByRole('list', { name: 'Tasks' });
    this.toasts = page.getByRole('region', { name: 'Notifications' });
    // Use the description line, which is unique to the empty-state component
    // (the "No tasks yet" string also appears in the polite live region).
    this.emptyState = page.getByText("Tasks will appear here once they're created.", {
      exact: true,
    });
  }

  async goto(): Promise<void> {
    await this.page.goto('/');
    // Wait for either the populated list or the empty-state hero — both prove
    // the FE has rendered past its loading state.
    await this.tasksList.or(this.emptyState).first().waitFor();
  }

  row(title: string): Locator {
    return this.tasksList.getByRole('listitem').filter({ hasText: title });
  }

  checkboxFor(title: string, target: 'completed' | 'pending'): Locator {
    return this.page.getByRole('checkbox', { name: `Mark "${title}" as ${target}` });
  }

  editButton(title: string): Locator {
    return this.page.getByRole('button', { name: `Edit "${title}"` });
  }

  deleteButton(title: string): Locator {
    return this.page.getByRole('button', { name: `Delete "${title}"` });
  }

  saveButton(): Locator {
    return this.page.getByRole('button', { name: 'Save' });
  }

  cancelButton(): Locator {
    return this.page.getByRole('button', { name: 'Cancel' });
  }

  editInput(): Locator {
    return this.page.getByRole('textbox', { name: 'Edit task title' });
  }
}
