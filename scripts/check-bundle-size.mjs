#!/usr/bin/env node
/**
 * Bundle-size budget check. Builds nothing on its own — assumes
 * `packages/frontend/dist/` already exists (i.e. ran after `vite build`).
 *
 * Reports each tracked asset's gzipped size against a budget; exits non-zero
 * if any asset exceeds its budget.
 *
 * To bump a budget, change the constant below and explain why in the commit
 * message.
 */
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, resolve } from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';
import { gzipSync } from 'node:zlib';

const HERE = fileURLToPath(new URL('.', import.meta.url));
const REPO_ROOT = resolve(HERE, '..');
const DIST = process.argv[2] ?? join(REPO_ROOT, 'packages/frontend/dist/assets');

/** Gzipped size budgets in kB. Keep these tight — bumping is a deliberate act. */
const BUDGETS_KB = {
  js: 110,
  css: 8,
};

let failed = false;
let assetsChecked = 0;

const entries = readdirSync(DIST);
for (const name of entries) {
  const full = join(DIST, name);
  if (!statSync(full).isFile()) continue;
  const ext = name.split('.').pop();
  if (!ext || !(ext in BUDGETS_KB)) continue;
  const budgetKb = BUDGETS_KB[ext];
  const raw = readFileSync(full);
  const gzKb = gzipSync(raw).length / 1024;
  const ok = gzKb <= budgetKb;
  const status = ok ? 'OK  ' : 'FAIL';
  console.log(
    `${status}  ${name}  ${gzKb.toFixed(2)} kB gzipped  (budget ${budgetKb.toFixed(2)} kB)`,
  );
  if (!ok) failed = true;
  assetsChecked += 1;
}

if (assetsChecked === 0) {
  console.error(`No tracked assets found in ${DIST}. Did the build run?`);
  process.exit(1);
}

process.exit(failed ? 1 : 0);
