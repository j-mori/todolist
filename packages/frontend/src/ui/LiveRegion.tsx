/**
 * Polite live region. Visually hidden, announced by assistive tech when the
 * `message` prop changes.
 */
export const LiveRegion = ({ message }: { message: string }) => (
  <div role="status" aria-live="polite" className="sr-only">
    {message}
  </div>
);
