# Instagram guided automation Implementation Plan

> **For agentic workers:** Use superpowers:executing-plans, inline implementation and a final independent review.

**Goal:** Connect each Instagram in a fresh visible browser, guide account-specific media/configuration and require Stories review before scheduling.
**Architecture:** Reuse React/TanStack, existing storage and authenticated Hot Profiles connector. Transfer only short-lived OAuth state to a new browser; preserve callback cookie verification. Keep media in object storage, not PostgreSQL blobs.
**Spec:** User request and fluxo_automacao_instagram.pdf. PDF account creation is context, not authorization to build bulk signup. Story links remain manual Instagram publishing with reminders. No live publication in tests.
**Tech Stack:** TypeScript, Node, PostgreSQL, React.

## Global Constraints
- Preserve existing data and modules. No tokens in logs/URLs beyond provider OAuth state.
- Every new connection uses a unique local browser directory; no fallback silently reusing cookies.
- 1–10 Reels/day, per-account library and explicit Stories choice.
- Persisted queue remains subject to workspace RLS and existing media/account guards.

## Review Focus
- OAuth callback browser cookie binding survives isolation.
- Failed connector or obsolete version cannot claim isolation succeeded.
- Changing account or schedule invalidates previous review.
- Stories unavailable or other-account reminders cannot pass the gate.
- Double submissions stay idempotent and do not schedule other accounts.

### Task 1: Isolated login
Files: tools/hot-profiles/instagram-login.mjs, browser.mjs, bridge.mjs; src/lib/api/instagram-oauth.functions.ts; src/components/postkit/InstagramLocalLogin.tsx.
Interfaces: authenticated bridge POST /v1/instagram-login consumes provider URL and cookie metadata returned by authenticated OAuth start; unique session response.
- [ ] Test URL/origin/cookie validation and launch isolation, observe failure.
- [ ] Implement bounded visible sessions and cookie bootstrap without app credentials.
- [ ] Run node --test tests/instagram-local-login.test.mjs (Expected: PASS).

### Task 2: Account review and scheduling gate
Files: src/lib/instagram-automation-review.ts, new SQL migration, postkit-database.ts, tests/instagram-automation-review.test.mjs.
Interfaces: review decision skip/planned; SQL schedule_reviewed_instagram_reels atomically verifies actor/account/media/Stories before inserting idempotent scheduled posts.
- [ ] Write failing gate tests for missing reviews, cross-account and stale data.
- [ ] Implement and validate SQL with PGlite.
- [ ] Run node --experimental-strip-types --test tests/instagram-automation-review.test.mjs (Expected: PASS).

### Task 3: Guided workflow
Files: src/routes/automacao-instagram.tsx, src/components/postkit/InstagramAutomationReview.tsx, docs/instagram-guided-automation.md.
Interfaces: account selection drives library/config/Stories/review; existing preview creates queue, review RPC commits it.
- [ ] Add guided cards, fresh login and explicit final checklist.
- [ ] Validate browser rendering, regression suite, TypeScript and build.
- [ ] One final branch review, fix important findings, commit and integrate under existing authorization.
