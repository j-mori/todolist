const REPO_URL = 'https://github.com/j-mori/todolist';

/**
 * Visible only when the bundle was built with `VITE_DEMO_MODE=true`. Tells the
 * visitor the API is mocked in their browser and points at the repo for the
 * full backend setup.
 */
export const DemoBanner = () => {
  if (import.meta.env.VITE_DEMO_MODE !== 'true') return null;

  return (
    <aside
      role="note"
      aria-label="Demo mode notice"
      className="border-b border-border bg-surface-muted text-fg-muted"
    >
      <div className="mx-auto flex max-w-2xl flex-wrap items-baseline gap-x-2 gap-y-1 px-6 py-2 text-sm">
        <strong className="font-medium text-fg">Demo mode.</strong>
        <span>The backend is mocked in your browser — every change resets on reload.</span>
        <a
          href={REPO_URL}
          target="_blank"
          rel="noreferrer"
          className="font-medium text-primary underline-offset-4 hover:underline"
        >
          Run the full app locally →
        </a>
      </div>
    </aside>
  );
};
