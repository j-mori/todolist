# ADR-0009: Tailwind v4 for styling

**Status:** accepted
**Date:** 2026-05-04
**Session:** 01

## Context
Three tasteful options: **Tailwind v4** (utility-first, dominant in 2026, single Vite plugin, no PostCSS config, design tokens as CSS vars), **CSS Modules** (zero deps, scoped natively in Vite, more discipline), **vanilla-extract** (TS-typed CSS-in-CSS, zero runtime, smaller community). For a "showcase the way to build software in 2026" reference, the styling choice carries signal value.

## Decision
Use **Tailwind v4** via the **`@tailwindcss/vite`** plugin. A single `src/styles.css` declares `@import "tailwindcss";`. No `tailwind.config.js` is needed in v4 — design tokens live as CSS custom properties in `styles.css`. No PostCSS config.

## Consequences
- **Positive:** Zero config beyond a single CSS import. Fast incremental rebuilds via the Vite plugin (no PostCSS pipeline). Familiar mental model. Dark mode and design tokens via CSS variables.
- **Trade-off:** Long className strings in markup. Mitigated by extracting components, not by CSS-in-JS abstractions.
- **Follow-up:** Session 4 introduces design-token CSS variables in `styles.css` if needed.

## Alternatives considered
- **CSS Modules** — rejected: less of a "state of the art" signal; more friction for the small number of components we need.
- **vanilla-extract** — rejected: tasteful but smaller community, lower returns on the showcase axis.
- **Styled Components / Emotion** — rejected: runtime cost, RSC unfriendly, declining mindshare in 2026.
