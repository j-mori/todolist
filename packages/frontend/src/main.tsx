import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { getApiBaseUrl } from './adapters/api/api-base-url.ts';
import { createHttpClient } from './adapters/api/http-client.ts';
import { createTasksApi } from './adapters/api/tasks-api.ts';
import { TasksApiProvider } from './application/api-context.tsx';
import { NotificationsProvider } from './application/notifications/notifications-context.tsx';
import { QUERY_CLIENT_DEFAULTS } from './application/queries/query-client-config.ts';
import { App } from './ui/App.tsx';
import { ErrorBoundary } from './ui/ErrorBoundary.tsx';
import './styles.css';

const startMockWorker = async (): Promise<void> => {
  if (import.meta.env.VITE_DEMO_MODE !== 'true') return;
  const { worker } = await import('./mocks/browser.ts');
  await worker.start({
    serviceWorker: { url: `${import.meta.env.BASE_URL}mockServiceWorker.js` },
    onUnhandledRequest: 'bypass',
  });
};

const httpClient = createHttpClient({ baseUrl: getApiBaseUrl() });
const tasksApi = createTasksApi(httpClient);
const queryClient = new QueryClient(QUERY_CLIENT_DEFAULTS);

const container = document.getElementById('root');
if (!container) throw new Error('root container missing in index.html');

await startMockWorker();

createRoot(container).render(
  <StrictMode>
    <ErrorBoundary>
      <TasksApiProvider value={tasksApi}>
        <QueryClientProvider client={queryClient}>
          <NotificationsProvider>
            <App />
          </NotificationsProvider>
        </QueryClientProvider>
      </TasksApiProvider>
    </ErrorBoundary>
  </StrictMode>,
);
