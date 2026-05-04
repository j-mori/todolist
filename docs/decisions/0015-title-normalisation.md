# ADR-0015: Title normalisation — trim before validate, cap at 200 chars

**Status:** accepted
**Date:** 2026-05-04
**Session:** 02

## Context
`TaskTitle` is the only free-form domain value. Two questions need an explicit answer:
1. Do we trim user input, and if so, before or after validation?
2. What is the maximum allowed length?

Implicit answers tend to leak: a "5-char min" is silently bypassed by `"     "`, and a missing cap means a single user can stuff 1 MB of "task" into the database and break the UI.

## Decision
**Trim first, then validate.** `TaskTitle.from(input)` calls `input.trim()`, then rejects empty (post-trim) and rejects `length > 200`. The trimmed string is what's stored. Whitespace-only input therefore fails as "empty", with a `ValidationError { field: 'title', reason: 'must not be empty' }`.

**Cap = 200 characters.** Long enough for any real task (longer than a tweet, shorter than a paragraph), short enough that the FE can render it without truncation logic in the common case.

## Consequences
- **Positive:** No "phantom" tasks (whitespace-only). Storage and rendering have a known upper bound. The trim happens once, at the boundary of construction, so the rest of the system sees a normalised value.
- **Trade-off:** A user typing `"buy milk\n"` in a textarea will have the newline stripped silently. That's the right call for a single-line title; if we ever introduce a multi-line description field, it gets its own VO with its own rules.
- **Follow-up:** If product asks for a different cap, change `TASK_TITLE_MAX_LENGTH` in one place; the test asserting "rejects > 200" will pin the new contract.

## Alternatives considered
- **Validate before trim** — rejected: would let `"   "` pass a `min(1)` check, which is the opposite of the intent.
- **No trim** — rejected: leaks UI noise (trailing newlines from textareas) into the domain.
- **No length cap** — rejected: invites abuse and gives the UI no contract to design against.
