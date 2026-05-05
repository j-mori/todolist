import type { ReactNode } from 'react';
import { DemoBanner } from './DemoBanner.tsx';
import { NotificationsViewport } from './NotificationsViewport.tsx';

export const AppShell = ({ children }: { children: ReactNode }) => (
  <div className="min-h-dvh">
    <DemoBanner />
    <header className="border-b border-border">
      <div className="mx-auto flex max-w-2xl items-baseline justify-between px-6 py-6">
        <h1 className="text-2xl font-semibold tracking-tight">To-Do List</h1>
      </div>
    </header>
    <main className="mx-auto max-w-2xl px-6 py-8">{children}</main>
    <NotificationsViewport />
  </div>
);
