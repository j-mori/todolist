# ADR-0021: Schema initialised idempotently on boot — no migration runner (yet)

**Status:** accepted
**Date:** 2026-05-04
**Session:** 03

## Context
Storage is `node:sqlite` (ADR-0006). The schema today is one table and one index. Real apps grow migrations runners (umzug, kysely-ctl, knex, sqlx) for one reason: schemas evolve and you need ordered, transactional, recorded changes against existing data. None of that pressure exists at this point in the project.

The risk of installing a runner pre-emptively: it grows ceremony (a `migrations/` folder, a CLI, a "did anyone run it?" doc) for zero current benefit, and a future session could mistake the ceremony for a requirement.

## Decision
**Idempotent inline initialisation on boot.** `initSchema(db)` runs:

```sql
CREATE TABLE IF NOT EXISTS tasks ( ... );
CREATE INDEX IF NOT EXISTS idx_tasks_created_at ON tasks (created_at DESC);
```

`compose()` calls it before returning the wired app. The function is idempotent so it's safe to call on every container start.

When the schema **actually** evolves post-Session-3, the next session adopts a real migration runner and writes ADR-0022 documenting the choice. We do not pre-empt that decision.

## Consequences
- **Positive:** Zero ceremony today. Container start works on a brand-new volume or an existing one without operator intervention. The integration test suite gets a fresh schema per `:memory:` database for free.
- **Trade-off:** The first real schema change will be slightly more painful than if we had a runner ready — we'll need to add the runner *and* the first migration in the same change. Acceptable; we save ourselves from carrying an unused runner for an unbounded period.
- **Follow-up:** When the schema needs to change destructively (`ALTER TABLE`, data backfills, unique-constraint additions), introduce a runner. Candidates to evaluate at that point: Kysely's built-in migrator, umzug, raw SQL files run by a tiny custom loop. **Do not** assume the answer is "Kysely's migrator" without re-evaluating.

## Alternatives considered
- **Kysely's built-in migrator** — rejected for now: needs a `migrations/` folder, a Provider, and a journal table; ceremony with no payoff at one statement.
- **External migration runner (umzug, sqlx-cli)** — rejected for now: installs a CLI dependency for one CREATE TABLE.
- **Skip schema init, document "run this SQL manually"** — rejected: makes "run with Docker" multi-step; breaks self-contained-ness.
