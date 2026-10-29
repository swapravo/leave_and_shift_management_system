# Decision Log

Git history records **what** changed. This log records **why**: the intent, the reasoning and the alternatives we
turned down, for every change made to this repository.

## Rules
1. **Every change to the repo gets an entry**: code, schema, config, tests or docs. Several commits for the same
   reason share one entry; one commit touching several unrelated reasons gets several entries.
2. **Append-only.** New entries go at the bottom with the next number (`D-001`, `D-002`, …). Never rewrite an
   entry's reasoning after it's committed; fixing typos is fine.
3. **Changing a decision** = a new entry that says `Supersedes: D-0xx`, and the old entry's status changes to
   `Superseded by D-0yy` (the only edit allowed to an old entry).
4. **Commits reference their entry** with a trailer line: `Refs: D-012` (or `Refs: D-012, D-013`). Find the commits
   for an entry with `git log --grep "D-012"`.
5. **Who decided** is always stated: *Owner* (the project owner decided or confirmed it) or *Claude, proposed*
   (my proposal, not yet confirmed). An entry with a *Claude, proposed* decision changes to *Owner* once confirmed;
   if it's rejected, a superseding entry records the replacement.

## Entry template
```markdown
### D-NNN: <short title>
- **Date:** YYYY-MM-DD
- **Status:** Accepted | Superseded by D-NNN
- **Decided by:** Owner | Claude, proposed
- **Context:** what prompted this; the problem or question
- **Decision:** what we chose
- **Why:** the reasoning
- **Alternatives considered:** what else was on the table and why not
- **Consequences:** what this commits us to, risks, follow-ups
- **Affects:** files, docs, components
```

---

### D-001: Keep a decision log of the "why"
- **Date:** 2026-10-28
- **Status:** Accepted
- **Decided by:** Owner
- **Context:** Commit messages describe what changed, but the reasoning (why this option, what was rejected) gets
  lost. That reasoning matters most when someone, human or Claude, later wants to change the code.
- **Decision:** One append-only file, `docs/decision-log.md`, with numbered entries. Commits reference entries with
  `Refs: D-NNN`. A changed decision gets a new superseding entry; the old one is kept. The log starts with this
  change; decisions made earlier in planning are recorded in the [feature plan](00-feature-plan.md), not
  backfilled here.
- **Why:** A single file is easy to read top to bottom and to search. Append-only plus superseding keeps the
  history of thinking intact. Commit trailers link *what* and *why* in both directions.
- **Alternatives considered:** One ADR file per decision (`docs/decisions/0001-*.md`): better for large teams but
  more files to navigate for a project this size. Backfilling earlier decisions and a `CLAUDE.md` rule that
  enforces the log were offered and not chosen.
- **Consequences:** Every future change needs an entry in the same commit set. The rules live in this file.
- **Affects:** `docs/decision-log.md`, `docs/README.md`, `docs/00-feature-plan.md`

### D-002: List everything out of scope explicitly, with its source
- **Date:** 2026-10-28
- **Status:** Accepted
- **Decided by:** Owner (that the list exists); the rows marked *Proposed* in the list are Claude, proposed
- **Context:** The docs only named a few exclusions (payroll/HRIS, multi-level approvals, half-days, …). Anything
  not mentioned could be assumed to be in scope.
- **Decision:** Add an "Out of scope (explicit)" section to the feature plan, grouped by area. Each row gives its
  source (BRD / Confirmed / Proposed) and what the system does instead. The HLD's scope section links to it.
- **Why:** Saying "no" in writing prevents scope creep and wrong assumptions during the build. The source column
  separates what the BRD excludes from what we decided and from what still needs confirmation.
- **Alternatives considered:** A short bullet list in the HLD: easier to scan but loses the source and the
  replacement behaviour for each item.
- **Consequences:** Rows marked *Proposed* need a yes/no from the owner. Adding any of these items later needs a
  new decision entry.
- **Affects:** `docs/00-feature-plan.md`, `docs/01-high-level-design.md`

### D-003: Test with Playwright end-to-end, plus pytest and Vitest
- **Date:** 2026-10-28
- **Status:** Accepted
- **Decided by:** Owner
- **Context:** The docs only mentioned a Playwright "smoke" test. The owner asked for Playwright to be the testing
  approach.
- **Decision:** Three layers. **Playwright** E2E covers every user journey, role access and the three BRD success
  criteria in a real browser. **pytest** covers backend rules (coverage, accrual, refunds, guards). **Vitest**
  covers pure frontend helpers. A full catalogue with stable test IDs is in
  [Testing strategy](06-testing-strategy.md).
- **Why:** Playwright proves that what users actually do works across frontend, API and database together. The
  domain rules have many edge cases that are faster and more precise to test directly than through the UI.
- **Alternatives considered:** Playwright only (also for API tests): one tool, but slow and indirect for rule edge
  cases. Playwright + pytest without Vitest: leaves date maths untested in isolation.
- **Consequences:** Every feature needs both a pytest rule test and a Playwright journey to count as done.
- **Affects:** `docs/06-testing-strategy.md`, `docs/03-technical-requirements.md`, future `app/e2e/`,
  `app/backend/tests/`

### D-004: Playwright in TypeScript, pinned to 1.63.0, Chromium only
- **Date:** 2026-10-28
- **Status:** Accepted
- **Decided by:** Owner (TypeScript, Chromium only); Claude, proposed (version pin, mobile-width project)
- **Context:** Choosing the Playwright flavour and which browsers to run.
- **Decision:** `@playwright/test` in TypeScript under `app/e2e/`, pinned to **1.63.0**. One desktop Chromium project
  runs everything; a mobile-width Chromium project runs only tests tagged `@mobile`.
- **Why:** TypeScript matches the frontend, so tests can share types with the API client. `@playwright/test`
  includes the runner, fixtures, traces and an HTML report. Version 1.63.0 matches the Chromium build already
  installed in the development environment, so no browser download is needed. Chromium alone is enough for an
  internal tool and keeps runs fast. The mobile project checks the responsive layout without doubling run time.
- **Alternatives considered:** Python `pytest-playwright`, same language as the backend but a different language
  from the UI under test. Chromium + Firefox + WebKit, about 3× slower for little gain here.
- **Consequences:** No Firefox/Safari-specific bugs will be caught.
- **Affects:** `docs/06-testing-strategy.md`, `docs/03-technical-requirements.md`, future `app/e2e/`

### D-005: Run tests locally only, with no CI pipeline
- **Date:** 2026-10-28
- **Status:** Accepted
- **Decided by:** Owner
- **Context:** Whether to add a GitHub Actions workflow.
- **Decision:** No CI. `app/scripts/test-all.sh` runs pytest → typecheck → Vitest → build → Playwright and must pass
  before every push.
- **Why:** The owner chose to keep the repository free of CI configuration for now.
- **Alternatives considered:** GitHub Actions on every push and PR: catches a forgotten local run, but adds a
  workflow file and CI setup.
- **Consequences:** Nothing stops a broken push automatically, so running the full suite before pushing is a hard
  rule. CI is listed as out of scope.
- **Affects:** `docs/06-testing-strategy.md`, `docs/03-technical-requirements.md`, `docs/00-feature-plan.md`

### D-006: Fresh seeded database before every E2E test, with a pinned date
- **Date:** 2026-10-28
- **Status:** Accepted
- **Decided by:** Owner (fresh DB per test); Claude, proposed (reset endpoint design, date 2026-06-10, one worker,
  fixed `password_changed_at` in the seed)
- **Context:** E2E tests change data (apply, approve, swap…). Tests that share data depend on each other's order.
- **Decision:** A test-only endpoint `POST /api/test/reset` reloads the deterministic seed. It exists only when the
  server runs with `LSM_TEST_MODE=1`. A Playwright auto fixture calls it before every test. "Today" is pinned to
  **2026-06-10** (a Wednesday) via `LSM_TODAY`. Tests run one at a time (one worker). Seeded users get a fixed
  `password_changed_at` so logins saved once per run stay valid across resets.
- **Why:** Every test starts from identical, known data, so tests can't affect each other and failures are
  reproducible. A mid-year Wednesday avoids year-boundary effects and keeps both weekday and weekend cases nearby.
  Registering the route only in test mode means it can't exist in a normal deployment.
- **Alternatives considered:** Seeding once per run, with each test using its own users and dates: faster, but
  tests become coupled and order-dependent. Restarting the server per test: too slow.
- **Consequences:** E2E runs are serial (slower). The reset endpoint is part of the API contract under the `test`
  tag. The seed must stay deterministic.
- **Affects:** `docs/06-testing-strategy.md`, `docs/02-low-level-design.md` (P5), `docs/openapi.yaml`,
  `docs/05-data-model.md`, `docs/03-technical-requirements.md`

### D-007: Delete the cold-open demo app
- **Date:** 2026-10-29
- **Status:** Accepted
- **Decided by:** Owner
- **Context:** `demo/` held `cold-open-app/` (a Node app built from a vague one-paragraph prompt) plus two
  documents about it (`demo/README.md`, `demo/cold-open-review.md`). It is not the app we are building, and
  keeping a second, unrelated implementation of the same product on the branch invites confusion.
- **Decision:** Remove the whole `demo/` folder: the app and the two documents that only describe it.
- **Why:** The branch should hold one implementation, built from the docs. The two documents have no purpose without
  the app they describe. Git history keeps all of it (`git show 28e7850:demo/README.md`).
- **Alternatives considered:** Delete only `demo/cold-open-app/` and keep the README and review: leaves documents
  that point at code that no longer exists.
- **Consequences:** `content/day-1.md`, `content/day-2.md` and `content/build-plan.md` still mention the cold-open
  app; `content/` is left untouched by the planning rules, so those references now point at history only.
- **Affects:** `demo/` (deleted), `docs/00-feature-plan.md`

### D-008: All source code under `app/`, backend package at `app/backend/app/`
- **Date:** 2026-10-29
- **Status:** Accepted
- **Decided by:** Owner (a new folder for all source code); Claude, proposed (the exact layout)
- **Context:** The owner asked for one folder to hold all source code. The docs disagreed on paths: the LLD named
  `app/db.py` and `app/schema.sql`, while the TRD's run commands (`cd app/backend` … `uvicorn app.main:create_app`)
  imply a Python package named `app` inside `app/backend/`.
- **Decision:** `app/` is the source root, with `backend/`, `frontend/`, `e2e/` and `scripts/` under it. The Python
  package is `app/backend/app/`. The LLD now says its paths are relative to `app/backend/` (and `app/frontend/`).
  Subfolders are created when their build step starts, not as empty placeholders.
- **Why:** Matches the run commands already in the TRD and the testing strategy, so only one sentence of the LLD had
  to change. Keeping code out of the repo root keeps it separate from `docs/` and `content/`.
- **Alternatives considered:** `src/` at the repo root: conflicts with every path already written in the docs.
  Flattening the package to `app/backend/*.py`: breaks the `app.main` import path the TRD uses.
- **Consequences:** Imports are `from app import db` etc., run from `app/backend/`.
- **Affects:** `app/README.md`, `docs/02-low-level-design.md`

### D-009: SQL schema with STRICT tables and CHECK constraints for single-row rules
- **Date:** 2026-10-29
- **Status:** Accepted
- **Decided by:** Owner (write the schema first); Claude, proposed (STRICT, the extra constraints)
- **Context:** First code artefact: `app/backend/app/schema.sql`, implementing the data model.
- **Decision:** One idempotent file (`CREATE … IF NOT EXISTS`) with every table, index and the audit-log triggers.
  Tables are `STRICT`. Every rule a single row can prove is a `CHECK` (see data model §5.6): date/time formats,
  role ⇔ team, status ⇔ timestamps, ledger signs and period shapes, refund-day states. Extra unique indexes: one
  `leave_taken` per request, one removed-shift row per (request, shift, date), an assignment in at most one open
  swap per side. Swap assignment ids have no foreign key; `restored_assignment_id` is `ON DELETE SET NULL`.
- **Why:** The database is the last line of defence: a service bug that writes a positive `leave_taken` or a
  second deduction for the same request fails loudly instead of silently corrupting a balance. STRICT stops
  SQLite's type affinity from storing `'1.5'` as text in a numeric column. The no-FK / SET NULL choices exist
  because unassigning deletes `shift_assignments` rows, which closed swaps and restore records may still mention.
- **Alternatives considered:** Plain tables with only the constraints listed in the data model: less protection,
  same effort. Enforcing more cross-row rules with triggers (overlaps, manager validity): duplicates service logic
  in a second language and makes errors harder to explain to the user.
- **Consequences:** Needs SQLite ≥ 3.37 for STRICT (Python 3.13 here ships 3.45.1). Services must write values
  that satisfy the CHECKs, e.g. `deactivated_at` together with `active = 0`. Checked by a throwaway script against
  61 bad rows and a set of valid ones; the permanent pytest version comes with P1.
- **Affects:** `app/backend/app/schema.sql`, `docs/05-data-model.md`
