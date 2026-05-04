# ADR-0007: Vite + React 19 for the frontend

**Status:** accepted
**Date:** 2026-05-04
**Session:** 01

## Context
The brief mandates React + TypeScript on the FE. The build tool is an open choice. **Vite** is the default in 2026, with a Rolldown-powered v8 line, Tailwind v4 plugin, mature React HMR, and trivial Vitest integration. **Rsbuild** is faster but smaller-ecosystem. **Parcel** has gaps in TS-first DX. **Next.js** would pull in SSR, routing and a server we don't need.

## Decision
Use **Vite (latest stable)** with `@vitejs/plugin-react` for the SWC-based React Fast Refresh. React **19.x** for the runtime. JSX runtime is automatic (`jsx: react-jsx`). No router (single-screen app); add one only if Session 4–5 prove the need.

## Consequences
- **Positive:** Best-in-class DX. Fast cold start, instant HMR. Tailwind v4 has a first-class Vite plugin. Vitest reuses the same Vite config.
- **Trade-off:** Production output ships as static assets behind nginx — no SSR. Acceptable for a CRUD list.
- **Follow-up:** If Session 5 needs nontrivial routing, evaluate `@tanstack/react-router` (type-safe) before reaching for `react-router`.

## Alternatives considered
- **Rsbuild** — rejected: smaller ecosystem; Tailwind v4 plugin and Vitest integration are first-class on Vite.
- **Parcel** — rejected: zero-config is appealing but breaks down with TS-strict + Tailwind v4 + Vitest combos.
- **Next.js** — rejected: brief asks for "back-end server + front-end client", not a unified SSR framework.
