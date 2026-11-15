# Instagram signup implementation plan

> Execute inline with superpowers:executing-plans. User authorized implementation and commit without further questions.

**Goal:** Add a local, attended Instagram signup tool to MauseHot, automating the initial form and exposing verification, cancellation and explicit outcome tracking.
**Architecture:** React route and shared catalog, authenticated loopback connector, existing Chrome/Edge CDP runtime. One active signup; no private API dependency. Credentials exist in memory only until initial form submission. Save only bounded outcome history locally.
**Tech stack:** Existing React/TypeScript, Node.js 22+, native CDP, node:test.
**Spec:** Approved conversation proposal: local browser, stop for platform verification, no claimed successful signup without evidence. Ten daily attempts is an application ceiling, not a platform quota or throughput guarantee.

## Research and decisions
- https://github.com/subzeroid/instagrapi/issues/1935 — maintainer describes signup rejection, not a stable library fix.
- https://github.com/subzeroid/instagrapi/issues/2676 — successful HTTP response may still contain signup rejection.
- https://github.com/subzeroid/instagrapi/issues — current registration reports remain unresolved; vendor claims are not independent verification.
- https://playwright.dev/docs/locators — browser automation viable in principle; existing CDP transport avoids a new installed runtime.
- MauseHot is the portal brand; Mouse Hot Downloader is a separate extension. Add portal route and catalog entry, preserving downloader.

## Constraints / review focus
- Only Instagram HTTPS signup is automated. Unexpected page, CAPTCHA, challenge or form changes stop automation.
- No proxy rotation, CAPTCHA bypass, fabricated identities or automatic retry after rejection.
- Contact, password and verification codes never enter history, logs or Git.
- Cancellation during launch and browser closure cannot produce false success or leak a running browser.
- Restart marks unfinished work interrupted; duplicate confirmed usernames cannot be resubmitted.
- Missing installed browser and old connector show actionable errors.
- Real account creation requires operator contact/verification; fixture tests must never be described as Instagram acceptance.

## Tasks
1. Write failing tests for validation, exclusive session ownership, cancellation during launch, history persistence and daily ceiling. Implement signup manager and restricted DOM adapter.
2. Add authenticated connector endpoints and runtime method, package all required files. Test auth and lifecycle, plus actual Chromium fixture form behavior.
3. Add portal route, connection controls, form, status and history; register in shared catalog. Build and visually verify empty/error states.
4. Run full repository tests and build, review diff, package connector and document evidence. Commit on feature branch.

## Execution ledger
- Checkout placed in permitted user workspace because Program Files denies filesystem writes. No user files modified.
- Ruling: use existing CDP runtime instead of Playwright in shipped connector, maintaining dependency-free Windows distribution.
- Product name selected per user request: **InstaStart**, subtitle Cadastro Instagram.
- Manager regressions passed: validation, exclusive operation, secret-free history, daily limit persistence, cancellation during startup, shutdown waiting and first terminal result winning during concurrent shutdown.
- Full repository suite: 146 passing, 0 failures. Offline Chrome form verification passed; portal screenshot verified at `docs/instastart-ui.png`.
- Independent review found startup cleanup and terminal transition races; both fixed with failing-then-passing regressions.
- npm initially resolved unenv rc.25, incompatible with the existing Nitro build. Local dependency aligned to rc.24 already recorded in bun.lock; no dependency manifest change.
- No real account has been created. No ten-account throughput claim is supported.
- Production build passed after aligning the existing lockfile version. Targeted lint passed. Desktop/ZIP distribution checks: 3 passed.
