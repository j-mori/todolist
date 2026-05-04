import { compose, type ComposedApp } from '../../src/main.ts';

export type TestApi = {
  request(path: string, init?: RequestInit): Promise<Response>;
  dispose(): Promise<void>;
};

export const startApi = async (): Promise<TestApi> => {
  const composed: ComposedApp = await compose({ databasePath: ':memory:', corsOrigin: '*' });
  return {
    request: async (path, init) => composed.app.request(path, init),
    dispose: composed.dispose,
  };
};

export const jsonRequest = (body: unknown, init?: RequestInit): RequestInit => ({
  ...init,
  method: init?.method ?? 'POST',
  headers: { 'content-type': 'application/json', ...(init?.headers ?? {}) },
  body: JSON.stringify(body),
});

export const readJson = async <T>(res: Response): Promise<T> => (await res.json()) as T;
