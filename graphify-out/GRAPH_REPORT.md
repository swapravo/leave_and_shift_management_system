# Graph Report - leave_and_shift_management_system  (2026-10-30)

## Corpus Check
- 117 files · ~144,109 words
- Verdict: corpus is large enough that graph structure adds value.
- Unclassified: 11 file(s) not represented in the graph (top: (none) 9, .ini 1, .css 1)

## Summary
- 786 nodes · 2019 edges · 29 communities (27 shown, 2 thin omitted)
- Extraction: 89% EXTRACTED · 11% INFERRED · 0% AMBIGUOUS · INFERRED: 217 edges (avg confidence: 0.95)
- Token cost: 0 input · 0 output

## Graph Freshness
- Built from commit: `6d17e261`
- Run `git rev-parse HEAD` and compare to check if the graph is stale.
- Run `graphify update .` after code changes (no API cost).

## Community Hubs (Navigation)
- Requests.tsx
- routers.py
- 7. Frontend
- package.json
- 4. Backend components
- test_birthday.py
- schema.sql
- Entry template
- 5.2 Tables
- org.py
- speckit-analyze/SKILL.md
- dates.ts
- run
- seed
- db.py
- Execution Steps
- 2. Task walkthroughs
- speckit-plan/SKILL.md
- speckit-specify/SKILL.md
- speckit-tasks/SKILL.md
- Leave & Shift Management System: the business case
- speckit-checklist/SKILL.md
- Landing.tsx
- speckit-clarify/SKILL.md
- speckit-implement/SKILL.md
- speckit-constitution/SKILL.md
- speckit-taskstoissues/SKILL.md
- CLAUDE.md

## God Nodes (most connected - your core abstractions)
1. `7. Frontend` - 62 edges
2. `6. API surface` - 45 edges
3. `ErrorBox()` - 29 edges
4. `formatDate()` - 28 edges
5. `Requests()` - 27 edges
6. `PeopleHome()` - 25 edges
7. `useMe()` - 24 edges
8. `Body` - 22 edges
9. `LeaveSheet()` - 22 edges
10. `4. Backend components` - 22 edges

## Surprising Connections (you probably didn't know these)
- ``services/audit`` --references--> `seed()`  [INFERRED]
  docs/generated/developer.md → app/backend/app/seed.py
- `3. Architecture in one page` --references--> `init_db()`  [INFERRED]
  docs/generated/developer.md → app/backend/app/db.py
- `D-013: Birthday leave` --references--> `upgrade()`  [INFERRED]
  docs/decision-log.md → app/backend/app/db.py
- ``db`` --references--> `changes()`  [INFERRED]
  docs/generated/developer.md → app/backend/app/db.py
- `3. Architecture in one page` --references--> `_mount_frontend()`  [INFERRED]
  docs/generated/developer.md → app/backend/app/main.py

## Import Cycles
- None detected.

## Communities (29 total, 2 thin omitted)

### Community 0 - "Requests.tsx"
Cohesion: 0.07
Nodes (97): Frontend — React + TypeScript + Vite, api, App(), MOVED, NotFound(), AuthContext, AuthProvider(), homeFor() (+89 more)

### Community 1 - "routers.py"
Cohesion: 0.07
Nodes (69): adjust_balance(), apply_leave(), assign(), cancel_leave(), cancel_swap(), copy_week(), create_leave_type(), create_shift_template() (+61 more)

### Community 2 - "7. Frontend"
Cohesion: 0.06
Nodes (57): ApiError, codeFor(), del(), get(), patch(), post(), Query, request() (+49 more)

### Community 3 - "package.json"
Cohesion: 0.06
Nodes (43): dependencies, @fontsource-variable/outfit@5.3.0, @fontsource-variable/work-sans@5.3.0, lucide-react@1.64.0, react@19.3.1, react-dom@19.3.1, react-router@7.18.4, devDependencies (+35 more)

### Community 4 - "4. Backend components"
Cohesion: 0.06
Nodes (27): create_app(), lifespan(), _mount_frontend(), startup(), login(), seeded(), test_reset_route_only_exists_in_test_mode(), test_reset_seeds_the_demo_data_and_is_deterministic() (+19 more)

### Community 5 - "test_birthday.py"
Cohesion: 0.11
Nodes (27): connect(), init_db(), birthday_leave(), casual(), run_everyone(), go(), set_birth(), test_a_birthday_inside_the_window_books_an_approved_bonus_day() (+19 more)

### Community 6 - "schema.sql"
Cohesion: 0.13
Nodes (35): audit_log, audit_log_no_delete, audit_log_no_update, balance_ledger, birthday_grants, ix_assignments_date, ix_assignments_shift_date, ix_assignments_user_date (+27 more)

### Community 7 - "Entry template"
Cohesion: 0.06
Nodes (32): 0. Feature Plan & Decision Record, Cancelling approved leave (auto re-roster, refund what's restored), Confirmed decisions, Context, Decision log, Decisions made while writing the docs — please review, Integrations & platform, Leave & balances (+24 more)

### Community 8 - "5.2 Tables"
Cohesion: 0.06
Nodes (31): 1. `stakeholder.md`: ROI in time and money, 2. `product-manager.md`: ease of use, 3. `developer.md`: how it is built, Boundaries, Final reply, How the three differ, How to work, Output (+23 more)

### Community 9 - "org.py"
Cohesion: 0.19
Nodes (23): fetch_value(), _active_hr_count(), _check_birth_date(), _check_password(), _check_team(), _check_team_name(), create_team(), create_user() (+15 more)

### Community 10 - "speckit-analyze/SKILL.md"
Cohesion: 0.08
Nodes (25): 1. Initialize Analysis Context, 2. Load Artifacts (Progressive Disclosure), 3. Build Semantic Models, 4. Detection Passes (Token-Efficient Analysis), 5. Severity Assignment, 6. Produce Compact Analysis Report, 7. Provide Next Actions, 8. Offer Remediation (+17 more)

### Community 12 - "dates.ts"
Cohesion: 0.20
Nodes (20): DOW, RangePicker(), addDays(), addMonths(), daysBetween(), fromUTC(), isISODate(), isWeekend() (+12 more)

### Community 13 - "run"
Cohesion: 0.15
Nodes (11): changes(), fetch_all(), fetch_one(), transaction(), upgrade(), _housekeeping(), booking_date(), _grant() (+3 more)

### Community 14 - "seed"
Cohesion: 0.16
Nodes (13): configure(), _approved_leave(), _birth_date(), _email(), _first_weekday_on_or_after(), _main(), _password_hash(), reset() (+5 more)

### Community 15 - "db.py"
Cohesion: 0.14
Nodes (6): audit_trigger_statements(), execute(), test_schema_constraints(), bad(), ok(), `db`

### Community 16 - "Execution Steps"
Cohesion: 0.12
Nodes (15): 1. Initialize Convergence Context, 2. Load Artifacts (Progressive Disclosure), 3. Build the Intent Inventory, 4. Assess the Codebase and Classify Findings, 5. Assign Severity, 6. Present the In-Session Findings Summary, 7. Append Convergence Tasks (or report converged), 8. Provide Next Actions (Handoff) (+7 more)

### Community 17 - "2. Task walkthroughs"
Cohesion: 0.13
Nodes (14): 1. Who uses it and what they came to do, 2. Task walkthroughs, 3. Ease-of-use features, 4. Guardrails that prevent mistakes, 5. Friction and open questions, 6. Role-by-screen map, Apply for leave (Employee or Manager): 4 steps minimum, 7 with every option, Approve or reject leave (Manager; HR for managers' leave): 3 steps to approve, 4 to reject (+6 more)

### Community 18 - "speckit-plan/SKILL.md"
Cohesion: 0.18
Nodes (10): Completion Report, Done When, Key rules, Mandatory Post-Execution Hooks, Outline, Phase 0: Outline & Research, Phase 1: Design & Contracts, Phases (+2 more)

### Community 19 - "speckit-specify/SKILL.md"
Cohesion: 0.18
Nodes (10): Completion Report, Done When, For AI Generation, Mandatory Post-Execution Hooks, Outline, Pre-Execution Checks, Quick Guidelines, Section Requirements (+2 more)

### Community 20 - "speckit-tasks/SKILL.md"
Cohesion: 0.18
Nodes (10): Checklist Format (REQUIRED), Completion Report, Done When, Mandatory Post-Execution Hooks, Outline, Phase Structure, Pre-Execution Checks, Task Generation Rules (+2 more)

### Community 21 - "Leave & Shift Management System: the business case"
Cohesion: 0.22
Nodes (8): 1. The problem in one paragraph, 2. What the product does about it, 3. Where the time and money are saved, 4. ROI model, 5. Cost and effort to run, 6. Risks and limits, 7. Decision asked of the reader, Leave & Shift Management System: the business case

### Community 22 - "speckit-checklist/SKILL.md"
Cohesion: 0.25
Nodes (7): Anti-Examples: What NOT To Do, Checklist Purpose: "Unit Tests for English", Example Checklist Types & Sample Items, Execution Steps, Post-Execution Checks, Pre-Execution Checks, User Input

### Community 23 - "Landing.tsx"
Cohesion: 0.29
Nodes (6): BENEFITS, FAQ, LEADS, PROBLEMS, PROOF, STEPS

### Community 24 - "speckit-clarify/SKILL.md"
Cohesion: 0.29
Nodes (6): Completion Report, Done When, Mandatory Post-Execution Hooks, Outline, Pre-Execution Checks, User Input

### Community 25 - "speckit-implement/SKILL.md"
Cohesion: 0.29
Nodes (6): Completion Report, Done When, Mandatory Post-Execution Hooks, Outline, Pre-Execution Checks, User Input

### Community 26 - "speckit-constitution/SKILL.md"
Cohesion: 0.33
Nodes (5): Outline, Post-Execution Checks, Pre-Execution Checks, Scope Guard, User Input

### Community 27 - "speckit-taskstoissues/SKILL.md"
Cohesion: 0.33
Nodes (5): Deprecation Notice, Outline, Post-Execution Checks, Pre-Execution Checks, User Input

## Knowledge Gaps
- **2 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `Leave & Shift Management System: developer guide` connect `4. Backend components` to `Requests.tsx`, `routers.py`, `7. Frontend`, `dates.ts`, `seed`?**
  _High betweenness centrality (0.110) - this node is a cross-community bridge._
- **Are the 61 inferred relationships involving `7. Frontend` (e.g. with `ApiError` and `request()`) actually correct?**
  _`7. Frontend` has 61 INFERRED edges - model-reasoned connections that need verification._
- **Should `Requests.tsx` be split into smaller, more focused modules?**
  _Cohesion score 0.06588373458602466 - nodes in this community are weakly interconnected._
- **Why does `6. API surface` connect `routers.py` to `org.py`, `4. Backend components`, `seed`?**
  _High betweenness centrality (0.081) - this node is a cross-community bridge._
- **Are the 44 inferred relationships involving `6. API surface` (e.g. with `adjust_balance()` and `apply_leave()`) actually correct?**
  _`6. API surface` has 44 INFERRED edges - model-reasoned connections that need verification._
- **Should `routers.py` be split into smaller, more focused modules?**
  _Cohesion score 0.07116104868913857 - nodes in this community are weakly interconnected._
- **Why does `7. Frontend` connect `7. Frontend` to `Requests.tsx`, `dates.ts`, `4. Backend components`?**
  _High betweenness centrality (0.079) - this node is a cross-community bridge._