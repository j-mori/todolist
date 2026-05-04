import { spawn, spawnSync } from 'node:child_process';
import { setTimeout as delay } from 'node:timers/promises';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import type { FullConfig } from '@playwright/test';

const __filename = fileURLToPath(import.meta.url);
const REPO_ROOT = resolve(dirname(__filename), '../../..');
const FE_HEALTH_URL = 'http://localhost:8081/healthz';
const BE_READY_URL = 'http://localhost:8081/api/readyz';
const STACK_FLAG_ENV = 'TODOLIST_E2E_STACK_OWNED';
const BOOT_TIMEOUT_MS = 120_000;
const POLL_INTERVAL_MS = 1_000;

const probe = async (url: string): Promise<boolean> => {
  try {
    const res = await fetch(url, { signal: AbortSignal.timeout(2_000) });
    return res.ok;
  } catch {
    return false;
  }
};

const isStackUp = async (): Promise<boolean> => {
  const [feUp, beReady] = await Promise.all([probe(FE_HEALTH_URL), probe(BE_READY_URL)]);
  return feUp && beReady;
};

const requireDockerCompose = (): void => {
  const result = spawnSync('docker', ['compose', 'version'], { stdio: 'ignore' });
  if (result.status !== 0) {
    throw new Error(
      'docker compose is required to boot the E2E stack. Install Docker Desktop or set up an external stack and re-run.',
    );
  }
};

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

const waitUntilReady = async (deadline: number): Promise<void> => {
  while (Date.now() < deadline) {
    if (await isStackUp()) return;
    await delay(POLL_INTERVAL_MS);
  }
  throw new Error(
    `Stack did not become ready within ${BOOT_TIMEOUT_MS}ms. Check 'docker compose logs' for diagnostics.`,
  );
};

export default async function globalSetup(_config: FullConfig): Promise<void> {
  if (await isStackUp()) {
    process.env[STACK_FLAG_ENV] = 'external';
    // biome-ignore lint/suspicious/noConsole: globalSetup intentionally narrates progress.
    console.log('[e2e] stack already running — leaving teardown to its owner');
    return;
  }

  requireDockerCompose();
  // biome-ignore lint/suspicious/noConsole: globalSetup intentionally narrates progress.
  console.log('[e2e] booting docker stack (docker compose up -d --wait --build)…');
  await dockerCompose(['up', '-d', '--wait', '--build']);
  // `--wait` already blocks on healthchecks, but we re-probe to defend against
  // edge cases where compose returns before our endpoints answer.
  await waitUntilReady(Date.now() + BOOT_TIMEOUT_MS);
  process.env[STACK_FLAG_ENV] = 'owned';
  // biome-ignore lint/suspicious/noConsole: globalSetup intentionally narrates progress.
  console.log('[e2e] stack ready');
}
