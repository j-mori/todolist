import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import type { FullConfig } from '@playwright/test';

const __filename = fileURLToPath(import.meta.url);
const REPO_ROOT = resolve(dirname(__filename), '../../..');
const STACK_FLAG_ENV = 'TODOLIST_E2E_STACK_OWNED';

const dockerCompose = (args: readonly string[]): Promise<void> =>
  new Promise((resolvePromise, rejectPromise) => {
    const child = spawn('docker', ['compose', ...args], {
      cwd: REPO_ROOT,
      stdio: 'inherit',
    });
    child.on('error', rejectPromise);
    child.on('exit', (code) => {
      if (code === 0) resolvePromise();
      else rejectPromise(new Error(`docker compose ${args.join(' ')} exited with code ${code}`));
    });
  });

export default async function globalTeardown(_config: FullConfig): Promise<void> {
  if (process.env[STACK_FLAG_ENV] !== 'owned') {
    // biome-ignore lint/suspicious/noConsole: globalTeardown intentionally narrates progress.
    console.log('[e2e] stack was external — leaving it untouched');
    return;
  }
  // biome-ignore lint/suspicious/noConsole: globalTeardown intentionally narrates progress.
  console.log('[e2e] tearing down docker stack (docker compose down -v)…');
  await dockerCompose(['down', '-v']);
}
