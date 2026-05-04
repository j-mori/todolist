import { createApp } from './adapters/http/app.ts';

export const compose = (): { app: ReturnType<typeof createApp> } => {
  const app = createApp();
  return { app };
};
