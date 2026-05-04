# Session 7 — Plan: Production Polish & DX

**Date:** 2026-05-04
**Branch:** `jacopo.mori/fe-foundations` (carries Sessions 4 + 5 + 6 uncommitted on top of the committed BE work)
**Goal:** Last mile — repo reads like a 2026-TS bible, onboarding is 30 seconds, CI enforces everything.

---

## Context recap

Sessions 1–3 (committed): monorepo, BE domain + adapters + API, ADR-0022 production hardening.
Sessions 4–6 (uncommitted, all green): FE foundations + features + Playwright E2E.

Backend operational concerns from ADR-0022 are **already shipped**: `/healthz` + `/readyz`, Hono `secureHeaders`, Pino with redaction, awaited `SIGTERM/SIGINT` shutdown, `bodyLimit`, env-validated `loadConfig`. nginx in front of the FE serves a strict CSP plus HSTS / COOP / CORP / X-Frame-Options / Referrer-Policy. So Session 7 is mostly **enforcement, documentation, and CI**, not new runtime hardening.

Open Session-7 work flagged by handoffs 5 + 6:
- Branch is uncommitted (~65 files modified + untracked). Settle commit shape **first**.
- No CI workflow yet. Provider: GitLab (origin `gitlab.molops.io/tooling/todolist.git`).
- Hex-layering enforcement is the documented "known gap" in `CLAUDE.md` and the Session-3 follow-up in ADR-0022.
- README, ADR index, and `CLAUDE.md` need a final pass.

---

## 1 — Commit hygiene (do this **first**, before any new work)

The `jacopo.mori/fe-foundations` branch carries Sessions 4 + 5 + 6 uncommitted on top of the committed Session 3 work. New work should land on a clean base.

**Plan:** three commits on the existing branch, in order, before Session 7 starts producing code:
1. `frontend: foundations — TanStack Query, theme, read-only TaskList (ADR-0023..0026)` — Session 4 deltas.
2. `frontend: features — mutations, notifications, prod-readiness audit (ADR-0027..0029)` — Session 5 deltas.
3. `e2e: Playwright suite + ADR-0030` — Session 6 deltas (new `packages/e2e/` workspace).

Where the diff blurs — e.g. `vite.config.ts` was touched in 4 and 5 — group with the **later** session and note it in the commit body. No squashing — preserving session granularity makes the history reviewable.

The personal-showcase repo has no Jira ticket; commit subjects use the conventional-commits prefix (`feat(frontend): …`) instead of `<ticket-id>` since CLAUDE.md's commit-format rule is the global Mollie convention but this repo is explicitly outside that scope.

Then add Session-7 commits on top, one per concern (README, docs, CI, layering, etc.).

## 2 — README rewrite (tight, comprehensive)

Keep current 30-second quickstart at the top. Replace the rest with:

- **Quickstart (30 s)** — `git clone … && docker compose up --build`. Explicit URLs: app `http://localhost:8081`, API health `http://localhost:3000/readyz`.
- **Local development** — `npm install`, `npm run dev`, `npm run check`, `npm run build`. One paragraph each.
- **Testing** — one paragraph + link to `docs/testing.md`.
- **Architecture** — Mermaid diagram (request flow: browser → nginx → /api proxy → Hono → use case → repo → SQLite, plus FE composition root) + link to `docs/architecture.md`.
- **Conventions** — three bullets + link to `CLAUDE.md`.
- **Decision log** — link to `docs/decisions/README.md`.
- **CI** — one paragraph: GitLab pipeline gates lint, types, tests, build, e2e on every push.
- **License** — kept as-is.

Drop the "How this repo is built" section about sessions — moved to `CLAUDE.md`'s Pointers.
Drop the inline CI snippet (was a placeholder; superseded by the real `.gitlab-ci.yml`).

## 3 — `docs/architecture.md` (new)

Single source of truth for "how the code is organised". One Mermaid diagram + one screen of prose per layer:

- **Composition** — Mermaid showing `index.ts → loadConfig → openWiredDatabase → compose(deps) → app` (BE) and `main.tsx → httpClient → tasksApi → QueryClient → NotificationsProvider → React tree` (FE).
- **Backend layers** — `domain/` (rules), `application/` (use cases + ports), `adapters/http/`, `adapters/persistence/sqlite/`. What each owns and what it must NOT import.
- **Frontend layers** — `domain/` (Result, ApiClientError), `application/` (api-context, queries, notifications, formatting), `adapters/api/`, `ui/`. Same import-direction rule.
- **Shared** — `packages/shared`: API contract only (Zod schemas + inferred types). No business logic.
- **E2E** — `packages/e2e`: black-box validation of the docker-composed stack. ADR-0030 conventions in two sentences.
- **Operational concerns** — health/readiness, structured logs, security headers (BE `secureHeaders` + nginx CSP), graceful shutdown, body limit. One sentence each, citing the file path.

Each section ≤ one screen. References ADRs by number, doesn't restate them.

## 4 — `docs/testing.md` (new)

The pyramid + what each layer does **and does not** do:

- **Unit (`node:test`, BE)** — pure domain + use cases. Real ports rejected here (use the in-memory test doubles wired in `task.test-support.ts`). DOES NOT touch HTTP, SQLite, or the network.
- **Integration (`node:test`, BE)** — composed app against `:memory:` SQLite + Hono in-process. Real adapters end-to-end at the API boundary. DOES NOT spin Docker, hit the network, or mock at the port boundary.
- **Component (Vitest + Testing Library + happy-dom, FE)** — renders components with realistic providers; asserts what the user perceives. DOES NOT bypass the api-context or assert internal state.
- **E2E (Playwright, `packages/e2e`)** — real Chromium against the docker-composed stack. Role-based selectors only. API-driven seeding/cleanup. DOES NOT use `data-testid`, `waitForTimeout`, `waitForLoadState('networkidle')`, or `.check()`/`.uncheck()` on rollback-prone interactions (per ADR-0030 + handoff-06).
- **The contract test asks "if I delete this behaviour, which test goes red?".** If the answer is "none", the test is wrong. If the answer is "every layer", the test belongs lower in the pyramid.

Plus a one-liner per command (`npm run test`, `npm run test --workspace @todolist/backend test:integration`, `npm run test:e2e`, `npm run test:e2e:ui`).

## 5 — Operational concerns: confirm + small additions

Most are already in place (see Context recap). Two small additions:

- **BE-side CSP** for the JSON API. Today only nginx serves CSP; the API is JSON-only and should defensively send `Content-Security-Policy: default-src 'none'; frame-ancestors 'none'` so any pathological client that ever tries to load a script or frame from the API gets a hard no. Wire via `secureHeaders({ contentSecurityPolicy: { … } })`. Pin in `security-headers.api.test.ts`.
- **`X-Powered-By` removed** if Hono ever sets one (it doesn't by default — assert it's absent in the headers test).

No changes to logs, shutdown, or readiness — they pass review.

## 6 — Script catalog audit

Current at root:
| Script | Runs |
|---|---|
| `dev` | per-workspace `dev` |
| `build` | per-workspace `build` |
| `test` | shared + backend + frontend (BE script runs both unit + integration via `'src/**/*.test.ts' 'test/**/*.test.ts'`) |
| `test:e2e` (+ `:ui`/`:headed`/`:report`) | delegates to `@todolist/e2e` |
| `typecheck` | per-workspace `typecheck` |
| `lint` / `format` | biome |
| `check:bundle-size` | build FE + run script |
| `check` | lint + typecheck + test + bundle-size |

**Issue:** the prompt asks `check` to run "lint + types + unit + integration"; today it does, because the BE workspace's `test` script globs both. But the integration suite isn't *visible* at the root level. Fix:
- Add root `test:integration` → delegates to `npm run test:integration --workspace @todolist/backend`.
- Document in CLAUDE.md + README.
- Leave the unified root `test` as the green-bar (still runs everything non-e2e in one go).

No alias collapsing needed — every script is referenced from at least one doc.

## 7 — `.gitlab-ci.yml` (new — primary CI target)

Origin is GitLab. One pipeline file at repo root.

```yaml
stages: [check, build, e2e]

variables:
  NODE_VERSION: "24"

default:
  image: node:24-alpine
  cache:
    key:
      files: [package-lock.json]
    paths: [node_modules/, .npm/]
  before_script:
    - npm ci --prefer-offline --no-audit

lint:        { stage: check, script: [npm run lint] }
typecheck:   { stage: check, script: [npm run typecheck] }
test:        { stage: check, script: [npm run test] }
layers:      { stage: check, script: [npm run check:layers] }   # see §8
build:       { stage: build, script: [npm run build], artifacts: { paths: [packages/frontend/dist/] } }
bundle:      { stage: build, script: [npm run check:bundle-size], needs: [build] }

e2e:
  stage: e2e
  image: mcr.microsoft.com/playwright:v1.51.0-jammy
  services: [docker:24-dind]
  variables: { DOCKER_HOST: "tcp://docker:2375", DOCKER_TLS_CERTDIR: "" }
  cache:
    - key: { files: [package-lock.json] }
      paths: [node_modules/, .npm/]
    - key: playwright-${CI_COMMIT_REF_SLUG}
      paths: [~/.cache/ms-playwright/]
  script:
    - npx playwright install --with-deps chromium
    - npm run test:e2e
  artifacts:
    when: on_failure
    paths:
      - packages/e2e/playwright-report/
      - packages/e2e/test-results/
    expire_in: 7 days
  needs: [lint, typecheck, test, layers]
```

Choices:
- `node:24-alpine` for the cheap path; Playwright's official image for e2e (already has Chromium + system deps).
- `dind` so e2e can run `docker compose up`.
- Cache `node_modules/` keyed off the lockfile, plus a separate cache for the Playwright browser binary keyed off the branch (so a re-run on the same branch is fast).
- `e2e` only runs after the cheap stage is green — wasted cycles on Docker if lint already failed.
- Failure artefacts (trace.zip / screenshots / video) are uploaded; success uploads nothing (Playwright config already drops success artefacts).
- No `--no-verify`, no skipped hooks. Matches CLAUDE.md.

Confirm the pipeline runs green on first push by tailing `glab ci status` after a push to a throwaway branch.

## 8 — Hex-layering enforcement (`dependency-cruiser`)

Closes the documented "known gap" + the ADR-0022 follow-up.

- Add `dependency-cruiser` as a root devDep.
- Config at repo root: `.dependency-cruiser.cjs`. Rules:
  - `domain/` → cannot import from `application/` or `adapters/`.
  - `application/` → cannot import from `adapters/`.
  - `adapters/` → cannot import from anything outside `application/` and `domain/` of the same package, plus `@todolist/shared`.
  - `__unsafe*` symbols (e.g. `__unsafeTaskId`) cannot be imported outside `domain/task/` (defensive belt-and-braces for the persistence boundary).
  - Identical rule sets applied per workspace (BE and FE both follow hex layout per ADR-0013).
- Script: `npm run check:layers` → `depcruise --config .dependency-cruiser.cjs packages/{backend,frontend}/src`.
- Wire into `npm run check` (between typecheck and test, so failures are obvious).
- Wire into the CI `layers` job.

ADR-0031 documents the choice (rejecting Biome plugin / waiting / lefthook-only as alternatives).

## 9 — `lefthook` pre-commit hook (cheap polish)

`lefthook` is a fast Go binary with low ceremony. Config at `.lefthook.yml`:

```yaml
pre-commit:
  parallel: true
  commands:
    biome:
      glob: "*.{ts,tsx,js,jsx,json,jsonc}"
      run: npx biome check --write --no-errors-on-unmatched {staged_files} && git add {staged_files}
```

No `pre-push` hook — the full `npm run check` is too slow to put on every push. CI is the green-bar gate.

Install via `npx lefthook install` documented in README + CLAUDE.md. Honours `--no-verify` (every git hook does); CLAUDE.md re-states that `--no-verify` is forbidden in our convention. ADR-0032 records the choice.

## 10 — ADR audit + addenda

Walk every ADR (0001–0030, 0026 deleted) and:
- Confirm `Status:` is still accurate.
- Mark anything contradicted by later changes.

Expected outcomes:
- **ADR-0022** has a stale "Two compose entry points" trade-off — collapsed in commit `17bb95b refactor(backend): collapse composeProduction into compose + openWiredDatabase`. Add a dated `## Addendum` ("collapsed to a single `compose` + `openWiredDatabase`") rather than rewriting history.
- **All other ADRs** verified `accepted`. No supersessions expected; if any surface during the audit they get a status change.

New ADRs in this session:
- **ADR-0031** — GitLab CI pipeline shape and stage ordering.
- **ADR-0032** — `dependency-cruiser` for hex-layer enforcement (closes the gap).
- **ADR-0033** — `lefthook` pre-commit (only if §9 is approved).

Update `docs/decisions/README.md` to list all three plus mark ADR-0022 with "(addendum 2026-05-04)".

## 11 — `CLAUDE.md` final review

Currently 139 lines. Targets:
- Bump test count line if anything changed (still 80 BE + 23 FE + 10 E2E = 113; verify post-commit).
- Replace the "Lint enforcement of these boundaries is a **known gap**" paragraph with a one-liner pointing to `npm run check:layers` and ADR-0032.
- Add `npm run check:layers`, root `test:integration`, and the lefthook install command to the scripts table.
- Add a CI section pointer (1 line: "CI: `.gitlab-ci.yml`, see `docs/architecture.md`").
- Drop the obsidian-path pointer to handoffs from the public README's view (CLAUDE.md keeps it for future Claude sessions — it's been useful).
- Final length ≤ 200 lines.

## 12 — Handoff

`/Users/jacopo.mori/Sites/obsidian/claude/todolist/handoffs/07-handoff.md`:
- Final state of the repo (key paths).
- Final test count + CI green confirmation.
- Any deferred items + why (e.g. cold-boot Playwright cache in CI image, CSP report-uri, i18n).
- v2 suggestions, informational only:
  - Migration runner once schema evolves (today: idempotent init on boot per ADR-0021).
  - Bring back a11y automation under a vitest-axe + axe-core/playwright pair if the project ever takes a public-facing direction (ADR-0026 was deleted in Session 6).
  - OpenAPI generation off the Zod contract (today: Zod is the contract).
  - Optimistic-concurrency tokens (today: last-write-wins, ADR-0014 follow-up).

---

## Deliverables checklist

- [ ] Sessions 4/5/6 split into 3 commits on `jacopo.mori/fe-foundations`.
- [ ] `README.md` rewritten — quickstart, Mermaid, links, no placeholders.
- [ ] `docs/architecture.md` written.
- [ ] `docs/testing.md` written.
- [ ] BE-side CSP + `X-Powered-By` absence pinned in `security-headers.api.test.ts`.
- [ ] `.dependency-cruiser.cjs` + `npm run check:layers` + wired into `npm run check` and CI.
- [ ] `.lefthook.yml` + install instructions (only if §9 is approved).
- [ ] `.gitlab-ci.yml` with `check` / `build` / `e2e` stages, caches, failure artefacts.
- [ ] ADRs 0031, 0032, (0033) added; ADR-0022 addendum; `docs/decisions/README.md` updated.
- [ ] `CLAUDE.md` polished, ≤ 200 lines.
- [ ] `npm run check` green; `npm run test:e2e` green; first GitLab pipeline green.
- [ ] `handoffs/07-handoff.md` written.
- [ ] Session 7 commits on a clean branch ready for review.

## Definition of done (from prompt)

- ✓ A new engineer running `docker compose up` is browsing the app within 30 s (already true; README puts the command line one above the URL).
- ✓ `npm run check` runs lint + types + unit + integration + bundle budget (today). Also adds `check:layers` post-§8.
- ✓ `npm run test:e2e` runs the rest.
- 🎯 CI green on first push (the bar for §7).
- ✓ The decision log tells the full story without reading commit history (audit + addenda + new ADRs ensure this).

## Decisions for you to confirm before I execute

1. **Commit shape** — three commits (one per session 4/5/6) before Session-7 work. **OK?**
2. **CI provider** — GitLab CI (`.gitlab-ci.yml`), based on origin remote. **OK?**
3. **Pre-commit hook** — add `lefthook` (§9 + ADR-0033) or skip? Recommended: add. (Tiny binary, no Node dep, clean DX.) **Add / Skip?**
4. **BE-side CSP** — defensively send `default-src 'none'; frame-ancestors 'none'` on JSON responses. **OK?**
5. **Branch name for Session-7 work** — keep `jacopo.mori/fe-foundations` (single long-lived branch ending Session 7) or open `jacopo.mori/session-7-polish` and rebase Session-4–6 commits onto `main` first? Recommended: keep current branch; the whole point is one clean MR at the end.

Approve the plan (with any tweaks) and I'll execute.
