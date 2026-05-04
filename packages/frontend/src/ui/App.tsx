import type { JSX } from 'react';

export const App = (): JSX.Element => (
  <main className="mx-auto max-w-2xl px-6 py-12">
    <h1 className="text-3xl font-semibold tracking-tight">To-Do List</h1>
    <p className="mt-2 text-slate-600">
      Scaffold ready. Domain, persistence, API and UI arrive in the following sessions.
    </p>
  </main>
);
