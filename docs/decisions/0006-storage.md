# ADR-0006: `node:sqlite` + Kysely for storage

**Status:** accepted
**Date:** 2026-05-04
**Session:** 01

## Context
The brief permits SQLite or JSON-based storage and forbids externally managed databases. We need (a) a self-contained storage engine, and (b) a way to write queries without smearing `unknown` row shapes through the codebase. Options for the engine: **`node:sqlite` (built-in)**, **`better-sqlite3`** (native dep, more features). Options for the query layer: raw SQL with hand-typed rows, **Kysely** (type-safe query builder, ~30kB, no codegen, no decorators), Drizzle (more ORM-like).

## Decision
Use **`node:sqlite`** as the engine and **Kysely** as a thin type-safe query builder. The repository adapter under `src/adapters/persistence/` exposes the application port and translates domain types to/from the database row schema. The DB file lives on a Docker volume in production; in tests it's an in-memory `:memory:` database created per test.

## Consequences
- **Positive:** Zero native dependencies (no `node-gyp`, no Alpine compile pain). Kysely gives us inferred query result types end-to-end. Schema migrations stay as raw SQL files in `src/adapters/persistence/migrations/` (added in Session 3).
- **Trade-off:** `node:sqlite` lacks a few `better-sqlite3` conveniences (e.g. some pragma helpers); not blocking.
- **Follow-up:** Session 3 defines the schema and migration runner. The volume is not yet in `docker-compose.yml` — added when the persistence adapter lands.

## Alternatives considered
- **Raw SQL only** — rejected: hand-typing every row interface is the kind of toil that makes a 2026 reference repo look like a 2018 one.
- **`better-sqlite3`** — rejected: native dep, slower Docker builds, no real upside vs. `node:sqlite` for our scope.
- **Drizzle** — rejected: more ORM-y; we want a query builder, not a schema-as-code framework here.
- **JSON file** — rejected: toy storage, won't showcase real persistence patterns or transactional behaviour.
