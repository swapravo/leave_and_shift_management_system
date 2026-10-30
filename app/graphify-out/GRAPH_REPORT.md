# Graph Report - app  (2026-10-30)

## Corpus Check
- 85 files · ~49,711 words
- Verdict: corpus is large enough that graph structure adds value.
- Unclassified: 7 file(s) not represented in the graph (top: (none) 5, .ini 1, .css 1)

## Summary
- 973 nodes · 3488 edges · 43 communities (35 shown, 8 thin omitted)
- Extraction: 92% EXTRACTED · 8% INFERRED · 0% AMBIGUOUS · INFERRED: 276 edges (avg confidence: 0.89)
- Token cost: 0 input · 0 output

## Graph Freshness
- Built from commit: `73db64c3`
- Run `git rev-parse HEAD` and compare to check if the graph is stale.
- Run `graphify update .` after code changes (no API cost).

## Community Hubs (Navigation)
- routers.py
- api.ts
- fetch_all
- ErrorBox
- conftest.py
- package.json
- dates.ts
- accrual.py
- Ctx
- leave.py
- org.py
- swaps.py
- App.tsx
- test_leave.py
- common.py
- seed.py
- .roster
- auth.py
- .one
- .sql
- test_accrual.py
- Requests.tsx
- compilerOptions
- _mount_frontend
- main.py
- test_cancel.py
- create_app
- test_seed.py
- test_views.py
- documentation-agent.md
- sqlite3
- schema.sql
- README.md
- test-all.sh
- CLAUDE.md
- dependencies
- Landing.tsx
- scripts
- vite
- @testing-library/jest-dom

## God Nodes (most connected - your core abstractions)
1. `Ctx` - 60 edges
2. `fetch_all()` - 42 edges
3. `ErrorBox()` - 41 edges
4. `execute()` - 40 edges
5. `record()` - 36 edges
6. `NotFound` - 34 edges
7. `formatDate()` - 34 edges
8. `ValidationFailed` - 33 edges
9. `useAction()` - 33 edges
10. `useMe()` - 32 edges

## Surprising Connections (you probably didn't know these)
- `3. `developer.md`: how it is built` --references--> `DomainError`  [INFERRED]
  .claude/agents/documentation-agent.md → backend/app/errors.py
- `3. `developer.md`: how it is built` --references--> `seed()`  [INFERRED]
  .claude/agents/documentation-agent.md → backend/app/seed.py
- `3. `developer.md`: how it is built` --references--> `notify()`  [INFERRED]
  .claude/agents/documentation-agent.md → backend/app/services/notify.py
- `3. `developer.md`: how it is built` --references--> `ApiError`  [INFERRED]
  .claude/agents/documentation-agent.md → frontend/src/api.ts
- `3. `developer.md`: how it is built` --references--> `useMe()`  [INFERRED]
  .claude/agents/documentation-agent.md → frontend/src/auth.tsx

## Import Cycles
- 3-file cycle: `backend/app/services/leave.py -> backend/app/services/roster.py -> backend/app/services/swaps.py -> backend/app/services/leave.py`

## Communities (43 total, 8 thin omitted)

### Community 0 - "routers.py"
Cohesion: 0.07
Nodes (64): adjust_balance(), apply_leave(), assign(), cancel_leave(), cancel_swap(), copy_week(), create_leave_type(), create_shift_template() (+56 more)

### Community 1 - "api.ts"
Cohesion: 0.06
Nodes (50): api, ApiError, codeFor(), del(), get(), patch(), post(), Query (+42 more)

### Community 2 - "fetch_all"
Cohesion: 0.14
Nodes (22): fetch_all(), placeholders(), runs_on(), coverage_grid(), gaps(), leave_status_on(), leave_violations(), leaves_by_user() (+14 more)

### Community 3 - "ErrorBox"
Cohesion: 0.16
Nodes (39): 3. `developer.md`: how it is built, Card(), ConfirmDialog(), DecisionDialog(), Empty(), ErrorBox(), Field(), LABELS (+31 more)

### Community 4 - "conftest.py"
Cohesion: 0.09
Nodes (22): Client, ed(), eve(), hr(), mona(), oscar(), test_bad_credentials_get_the_same_401(), test_deactivated_user_cannot_log_in_and_existing_token_dies() (+14 more)

### Community 5 - "package.json"
Cohesion: 0.15
Nodes (17): devDependencies, jsdom@29.1.1, @testing-library/dom@10.4.1, @types/react@19.3.0, @types/react-dom@19.3.0, typescript@5.9.3, vitest@5.0.5, name (+9 more)

### Community 6 - "dates.ts"
Cohesion: 0.21
Nodes (24): DOW, RangePicker(), addDays(), addMonths(), daysBetween(), fromUTC(), isISODate(), isWeekend() (+16 more)

### Community 7 - "accrual.py"
Cohesion: 0.14
Nodes (16): today(), available(), balances_for(), catch_up(), get_balances(), get_ledger(), run_monthly(), run_monthly_manual() (+8 more)

### Community 8 - "Ctx"
Cohesion: 0.24
Nodes (11): Ctx, _clean(), _dump(), list_entries(), create_type(), list_types(), _name_taken(), type_out() (+3 more)

### Community 9 - "leave.py"
Cohesion: 0.15
Nodes (30): now_iso(), execute(), record(), fmt_day(), fmt_range(), apply(), approvers(), _can_decide() (+22 more)

### Community 10 - "org.py"
Cohesion: 0.18
Nodes (29): hash_password(), require_roles(), fetch_one(), fetch_value(), NotFound, ValidationFailed, adjust(), get_user() (+21 more)

### Community 11 - "swaps.py"
Cohesion: 0.22
Nodes (19): Conflict, Forbidden, shift_interval(), approvers(), _assignment(), _auto_cancel(), cancel(), cancel_for_assignments() (+11 more)

### Community 12 - "App.tsx"
Cohesion: 0.14
Nodes (27): App(), MOVED, NotFound(), AuthContext, AuthProvider(), AuthState, homeFor(), NotAllowed() (+19 more)

### Community 13 - "test_leave.py"
Cohesion: 0.12
Nodes (28): d(), test_cancelled_leave_cannot_be_cancelled_again(), test_hr_sees_any_request(), test_only_the_requester_can_cancel(), apply(), test_approval_rechecks_balance(), test_approval_rechecks_coverage(), test_approval_removes_shifts_in_the_range_and_records_them() (+20 more)

### Community 14 - "common.py"
Cohesion: 0.12
Nodes (16): booking_date(), _grant(), _leave_type(), run(), can_manage_team(), get_template(), hr_admin_ids(), intervals_overlap() (+8 more)

### Community 15 - "seed.py"
Cohesion: 0.19
Nodes (10): days(), audit_trigger_statements(), _approved_leave(), _email(), _first_weekday_on_or_after(), _password_hash(), reset(), seed() (+2 more)

### Community 16 - ".roster"
Cohesion: 0.22
Nodes (19): test_coverage_counts_other_peoples_pending_leave(), test_copy_previous_week(), propose(), test_brd2_swap_involving_someone_on_approved_leave_is_blocked(), test_decline_and_cancel(), test_double_booking_after_the_swap_is_blocked(), test_full_flow_exchanges_the_two_shifts(), test_leave_approved_after_proposal_blocks_acceptance_and_approval() (+11 more)

### Community 17 - "auth.py"
Cohesion: 0.06
Nodes (23): clear_cookie(), hash_password_sync(), issue_token(), load_user(), me(), _read_ctx(), set_cookie(), user_from_token() (+15 more)

### Community 18 - ".one"
Cohesion: 0.15
Nodes (7): new_user(), test_another_hr_admin_can_be_demoted_or_deactivated_while_one_remains(), test_archiving_a_shift_removes_future_assignments_and_tells_the_manager(), test_create_user_validations(), test_manager_changing_role_stops_managing(), test_moving_a_user_to_another_team_releases_future_shifts(), test_teams_create_update_and_manager_rules()

### Community 19 - ".sql"
Cohesion: 0.18
Nodes (13): assign(), cell(), test_assign_and_unassign(), test_back_to_back_shifts_do_not_overlap(), test_cells_show_headcount_against_minimum(), test_copy_into_a_week_that_has_started_skips_past_days(), test_each_guard(), test_grid_shows_unscheduled_days_only_when_someone_is_assigned() (+5 more)

### Community 20 - "test_accrual.py"
Cohesion: 0.12
Nodes (13): monthly_credit(), World, test_accrual_starts_in_the_join_month(), test_adjustment_needs_a_reason_and_a_non_zero_amount(), test_balances_visible_to_self_team_manager_and_hr_only(), test_future_join_date_accrues_nothing_yet(), test_hr_admins_get_no_balances(), test_monthly_credit_examples() (+5 more)

### Community 21 - "Requests.tsx"
Cohesion: 0.12
Nodes (47): Frontend — React + TypeScript + Vite, useMe(), DecideButtons(), LeaveCard(), Pending, SwapCard(), SwapSummary(), useDecisions() (+39 more)

### Community 22 - "compilerOptions"
Cohesion: 0.11
Nodes (17): compilerOptions, allowImportingTsExtensions, isolatedModules, jsx, lib, module, moduleResolution, noEmit (+9 more)

### Community 24 - "main.py"
Cohesion: 0.16
Nodes (5): _flag(), load_settings(), Settings, lifespan(), startup()

### Community 25 - "test_cancel.py"
Cohesion: 0.40
Nodes (11): add_temp_template(), approved(), test_approved_leave_cannot_be_cancelled_once_started(), test_cancel_approved_restores_shifts_and_refunds_every_day(), test_owed_day_is_forfeited_once_the_date_passes(), test_owed_day_is_refunded_when_a_swap_puts_the_person_back(), test_owed_day_needs_as_many_shifts_as_were_removed(), test_rostering_the_person_on_an_owed_day_refunds_it() (+3 more)

### Community 26 - "create_app"
Cohesion: 0.20
Nodes (11): configure(), set_today(), configure(), error_body(), install(), _domain(), _http(), create_app() (+3 more)

### Community 27 - "test_seed.py"
Cohesion: 0.39
Nodes (6): settings_for(), login(), seeded(), test_reset_route_only_exists_in_test_mode(), test_reset_seeds_the_demo_data_and_is_deterministic(), test_seed_data_passes_every_rule()

### Community 29 - "test_views.py"
Cohesion: 0.22
Nodes (4): test_a_rolled_back_change_leaves_no_audit_row(), test_audit_log_is_append_only(), test_audit_never_stores_password_hashes(), test_nobody_is_notified_about_their_own_assignment()

### Community 30 - "documentation-agent.md"
Cohesion: 0.25
Nodes (7): 1. `stakeholder.md`: ROI in time and money, 2. `product-manager.md`: ease of use, Boundaries, Final reply, How the three differ, How to work, Output

### Community 31 - "sqlite3"
Cohesion: 0.20
Nodes (6): set_time(), build_org(), world(), test_schema_constraints(), bad(), ok()

### Community 32 - "schema.sql"
Cohesion: 0.13
Nodes (35): audit_log, audit_log_no_delete, audit_log_no_update, balance_ledger, birthday_grants, ix_assignments_date, ix_assignments_shift_date, ix_assignments_user_date (+27 more)

### Community 40 - "dependencies"
Cohesion: 0.20
Nodes (10): dependencies, @fontsource-variable/outfit@5.3.0, @fontsource-variable/work-sans@5.3.0, lucide-react@1.64.0, react@19.3.1, react-dom@19.3.1, react-router@7.18.4, @fontsource-variable/outfit (+2 more)

### Community 41 - "Landing.tsx"
Cohesion: 0.15
Nodes (11): @testing-library/react@16.3.0, @testing-library/user-event@14.6.1, BENEFITS, FAQ, Landing(), LEADS, PROBLEMS, PROOF (+3 more)

### Community 42 - "scripts"
Cohesion: 0.33
Nodes (6): scripts, build, dev, preview, test, typecheck

### Community 43 - "vite"
Cohesion: 0.40
Nodes (4): vite@8.3.5, @vitejs/plugin-react@6.1.1, vite, @vitejs/plugin-react

## Knowledge Gaps
- **8 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `3. `developer.md`: how it is built` connect `ErrorBox` to `api.ts`, `leave.py`, `seed.py`, `auth.py`, `Requests.tsx`, `documentation-agent.md`?**
  _High betweenness centrality (0.392) - this node is a cross-community bridge._
- **Are the 46 inferred relationships involving `Ctx` (e.g. with `adjust()` and `get_balances()`) actually correct?**
  _`Ctx` has 46 INFERRED edges - model-reasoned connections that need verification._
- **Should `routers.py` be split into smaller, more focused modules?**
  _Cohesion score 0.0669753086419753 - nodes in this community are weakly interconnected._
- **Why does `notify()` connect `leave.py` to `fetch_all`, `ErrorBox`, `swaps.py`, `common.py`, `auth.py`?**
  _High betweenness centrality (0.200) - this node is a cross-community bridge._
- **Should `api.ts` be split into smaller, more focused modules?**
  _Cohesion score 0.061343204653622425 - nodes in this community are weakly interconnected._
- **Why does `useMe()` connect `Requests.tsx` to `api.ts`, `ErrorBox`, `App.tsx`, `dates.ts`?**
  _High betweenness centrality (0.121) - this node is a cross-community bridge._
- **Should `fetch_all` be split into smaller, more focused modules?**
  _Cohesion score 0.13902439024390245 - nodes in this community are weakly interconnected._