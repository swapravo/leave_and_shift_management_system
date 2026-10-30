# Graph Report - app  (2026-10-30)

## Corpus Check
- 86 files · ~51,689 words
- Verdict: corpus is large enough that graph structure adds value.
- Unclassified: 7 file(s) not represented in the graph (top: (none) 5, .ini 1, .css 1)

## Summary
- 1012 nodes · 3624 edges · 42 communities (33 shown, 9 thin omitted)
- Extraction: 92% EXTRACTED · 8% INFERRED · 0% AMBIGUOUS · INFERRED: 298 edges (avg confidence: 0.88)
- Token cost: 0 input · 0 output

## Graph Freshness
- Built from commit: `4954762d`
- Run `git rev-parse HEAD` and compare to check if the graph is stale.
- Run `graphify update .` after code changes (no API cost).

## Community Hubs (Navigation)
- routers.py
- api.ts
- roster.py
- ErrorBox
- conftest.py
- package.json
- dates.ts
- Ctx
- Conflict
- leave.py
- org.py
- swaps.py
- App.tsx
- test_leave.py
- .sql
- seed.py
- .roster
- fetch_all
- .one
- test_roster.py
- test_accrual.py
- Requests.tsx
- compilerOptions
- _mount_frontend
- main.py
- test_cancel.py
- create_app
- test_seed.py
- connect
- coverage.py
- documentation-agent.md
- conftest.py
- schema.sql
- README.md
- test-all.sh
- swapOptions.ts
- CLAUDE.md
- clock.py
- working_days

## God Nodes (most connected - your core abstractions)
1. `Ctx` - 60 edges
2. `fetch_all()` - 42 edges
3. `ErrorBox()` - 41 edges
4. `execute()` - 40 edges
5. `record()` - 36 edges
6. `ValidationFailed` - 34 edges
7. `NotFound` - 34 edges
8. `formatDate()` - 34 edges
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
- `3. `developer.md`: how it is built` --references--> `useAction()`  [INFERRED]
  .claude/agents/documentation-agent.md → frontend/src/hooks.ts

## Import Cycles
- 3-file cycle: `backend/app/services/leave.py -> backend/app/services/roster.py -> backend/app/services/swaps.py -> backend/app/services/leave.py`

## Communities (42 total, 9 thin omitted)

### Community 0 - "routers.py"
Cohesion: 0.05
Nodes (77): clear_cookie(), hash_password_sync(), issue_token(), load_user(), me(), _read_ctx(), set_cookie(), user_from_token() (+69 more)

### Community 1 - "api.ts"
Cohesion: 0.07
Nodes (40): api, ApiError, codeFor(), del(), get(), patch(), post(), Query (+32 more)

### Community 2 - "roster.py"
Cohesion: 0.11
Nodes (31): placeholders(), Forbidden, NotFound, can_manage_team(), fmt_day(), get_template(), intervals_overlap(), parse_days() (+23 more)

### Community 3 - "ErrorBox"
Cohesion: 0.16
Nodes (41): Card(), ConfirmDialog(), DecisionDialog(), Empty(), ErrorBox(), Field(), LABELS, Loading() (+33 more)

### Community 4 - "conftest.py"
Cohesion: 0.11
Nodes (10): Client, test_bad_credentials_get_the_same_401(), test_deactivated_user_cannot_log_in_and_existing_token_dies(), test_employee_is_forbidden_from_admin_and_manager_endpoints(), test_login_returns_me_and_sets_httponly_cookie(), test_manager_cannot_open_another_teams_roster(), test_password_reset_invalidates_old_tokens(), test_role_comes_from_the_database_not_the_token() (+2 more)

### Community 5 - "package.json"
Cohesion: 0.06
Nodes (43): dependencies, @fontsource-variable/outfit@5.3.0, @fontsource-variable/work-sans@5.3.0, lucide-react@1.64.0, react@19.3.1, react-dom@19.3.1, react-router@7.18.4, devDependencies (+35 more)

### Community 6 - "dates.ts"
Cohesion: 0.18
Nodes (27): DOW, RangePicker(), addDays(), addMonths(), daysBetween(), fromUTC(), hasStarted(), isISODate() (+19 more)

### Community 7 - "Ctx"
Cohesion: 0.21
Nodes (13): Ctx, today(), adjust(), balances_for(), catch_up(), get_balances(), get_ledger(), run_monthly() (+5 more)

### Community 8 - "Conflict"
Cohesion: 0.18
Nodes (9): Conflict, DomainError, create_type(), list_types(), _name_taken(), type_out(), update_type(), _validate() (+1 more)

### Community 9 - "leave.py"
Cohesion: 0.18
Nodes (26): available(), fmt_range(), r2(), apply(), approvers(), _can_decide(), cancel(), _cancel_approved() (+18 more)

### Community 10 - "org.py"
Cohesion: 0.21
Nodes (25): hash_password(), require_roles(), ValidationFailed, get_user(), _active_hr_count(), _check_birth_date(), _check_password(), _check_team() (+17 more)

### Community 11 - "swaps.py"
Cohesion: 0.16
Nodes (24): now(), now_iso(), execute(), record(), expire_owed_days(), on_assignment_added(), notify(), approvers() (+16 more)

### Community 12 - "App.tsx"
Cohesion: 0.09
Nodes (35): App(), MOVED, NotFound(), AuthContext, AuthProvider(), AuthState, homeFor(), NotAllowed() (+27 more)

### Community 13 - "test_leave.py"
Cohesion: 0.13
Nodes (24): d(), apply(), test_approval_rechecks_balance(), test_approval_rechecks_coverage(), test_approval_removes_shifts_in_the_range_and_records_them(), test_approved_leave_starting_today_keeps_past_roster_untouched(), test_archived_leave_type_cannot_be_applied_for(), test_brd1_applying_for_leave_reduces_the_balance() (+16 more)

### Community 14 - ".sql"
Cohesion: 0.15
Nodes (21): booking_date(), birthday_leave(), casual(), set_birth(), test_a_birthday_inside_the_window_books_an_approved_bonus_day(), test_a_manager_s_birthday_notifies_hr(), test_a_weekend_birthday_moves_to_the_nearest_working_day(), test_birthdays_in_the_past_or_beyond_the_window_are_not_booked_yet() (+13 more)

### Community 15 - "seed.py"
Cohesion: 0.19
Nodes (11): days(), audit_trigger_statements(), _approved_leave(), _birth_date(), _email(), _first_weekday_on_or_after(), _password_hash(), reset() (+3 more)

### Community 16 - ".roster"
Cohesion: 0.19
Nodes (23): test_logout_clears_the_cookie(), test_copy_previous_week(), propose(), test_brd2_swap_involving_someone_on_approved_leave_is_blocked(), test_decline_and_cancel(), test_double_booking_after_the_swap_is_blocked(), test_full_flow_exchanges_the_two_shifts(), test_leave_approved_after_proposal_blocks_acceptance_and_approval() (+15 more)

### Community 17 - "fetch_all"
Cohesion: 0.11
Nodes (15): changes(), fetch_all(), fetch_one(), fetch_value(), upgrade(), _clean(), _dump(), list_entries() (+7 more)

### Community 18 - ".one"
Cohesion: 0.15
Nodes (9): test_preview_reports_everything_without_saving(), new_user(), test_another_hr_admin_can_be_demoted_or_deactivated_while_one_remains(), test_archiving_a_shift_removes_future_assignments_and_tells_the_manager(), test_create_user_validations(), test_deactivation_side_effects(), test_manager_changing_role_stops_managing(), test_moving_a_user_to_another_team_releases_future_shifts() (+1 more)

### Community 19 - "test_roster.py"
Cohesion: 0.16
Nodes (14): assign(), cell(), test_assign_and_unassign(), test_back_to_back_shifts_do_not_overlap(), test_cells_show_headcount_against_minimum(), test_copy_into_a_week_that_has_started_skips_past_days(), test_each_guard(), test_gap_alert_goes_to_the_manager_unless_they_caused_it() (+6 more)

### Community 20 - "test_accrual.py"
Cohesion: 0.13
Nodes (12): monthly_credit(), test_accrual_starts_in_the_join_month(), test_adjustment_needs_a_reason_and_a_non_zero_amount(), test_balances_visible_to_self_team_manager_and_hr_only(), test_future_join_date_accrues_nothing_yet(), test_hr_admins_get_no_balances(), test_monthly_credit_examples(), test_monthly_run_is_idempotent_and_rejects_future_months() (+4 more)

### Community 21 - "Requests.tsx"
Cohesion: 0.13
Nodes (43): 3. `developer.md`: how it is built, Frontend — React + TypeScript + Vite, useMe(), DecideButtons(), LeaveCard(), Pending, SwapCard(), SwapSummary() (+35 more)

### Community 22 - "compilerOptions"
Cohesion: 0.11
Nodes (17): compilerOptions, allowImportingTsExtensions, isolatedModules, jsx, lib, module, moduleResolution, noEmit (+9 more)

### Community 24 - "main.py"
Cohesion: 0.22
Nodes (3): _flag(), load_settings(), Settings

### Community 25 - "test_cancel.py"
Cohesion: 0.28
Nodes (14): add_temp_template(), approved(), test_approved_leave_cannot_be_cancelled_once_started(), test_cancel_approved_restores_shifts_and_refunds_every_day(), test_cancelled_leave_cannot_be_cancelled_again(), test_hr_sees_any_request(), test_only_the_requester_can_cancel(), test_owed_day_is_forfeited_once_the_date_passes() (+6 more)

### Community 26 - "create_app"
Cohesion: 0.22
Nodes (11): configure(), set_today(), configure(), error_body(), install(), _domain(), _http(), create_app() (+3 more)

### Community 27 - "test_seed.py"
Cohesion: 0.36
Nodes (5): login(), seeded(), test_reset_route_only_exists_in_test_mode(), test_reset_seeds_the_demo_data_and_is_deterministic(), test_seed_data_passes_every_rule()

### Community 28 - "connect"
Cohesion: 0.19
Nodes (9): connect(), init_db(), lifespan(), _housekeeping(), startup(), run_everyone(), go(), test_an_older_database_is_upgraded_in_place() (+1 more)

### Community 29 - "coverage.py"
Cohesion: 0.27
Nodes (6): coverage_grid(), gaps(), leave_status_on(), leave_violations(), leaves_by_user(), dashboard()

### Community 30 - "documentation-agent.md"
Cohesion: 0.25
Nodes (7): 1. `stakeholder.md`: ROI in time and money, 2. `product-manager.md`: ease of use, Boundaries, Final reply, How the three differ, How to work, Output

### Community 31 - "conftest.py"
Cohesion: 0.09
Nodes (18): set_time(), build_org(), ed(), eve(), hr(), mona(), oscar(), settings_for() (+10 more)

### Community 32 - "schema.sql"
Cohesion: 0.13
Nodes (35): audit_log, audit_log_no_delete, audit_log_no_update, balance_ledger, birthday_grants, ix_assignments_date, ix_assignments_shift_date, ix_assignments_user_date (+27 more)

### Community 38 - "swapOptions.ts"
Cohesion: 0.21
Nodes (10): MyShiftRef, onLeave(), SwapOption, swapOptions(), cells, mine, NOON, CalendarLeave (+2 more)

## Knowledge Gaps
- **9 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `3. `developer.md`: how it is built` connect `Requests.tsx` to `api.ts`, `ErrorBox`, `Conflict`, `swaps.py`, `seed.py`, `documentation-agent.md`?**
  _High betweenness centrality (0.384) - this node is a cross-community bridge._
- **Are the 46 inferred relationships involving `Ctx` (e.g. with `adjust()` and `get_balances()`) actually correct?**
  _`Ctx` has 46 INFERRED edges - model-reasoned connections that need verification._
- **Should `routers.py` be split into smaller, more focused modules?**
  _Cohesion score 0.05006662859318484 - nodes in this community are weakly interconnected._
- **Why does `notify()` connect `swaps.py` to `fetch_all`, `roster.py`, `Requests.tsx`, `leave.py`?**
  _High betweenness centrality (0.202) - this node is a cross-community bridge._
- **Should `api.ts` be split into smaller, more focused modules?**
  _Cohesion score 0.07428571428571429 - nodes in this community are weakly interconnected._
- **Why does `useAction()` connect `ErrorBox` to `api.ts`, `App.tsx`, `Requests.tsx`?**
  _High betweenness centrality (0.114) - this node is a cross-community bridge._
- **Should `roster.py` be split into smaller, more focused modules?**
  _Cohesion score 0.11320754716981132 - nodes in this community are weakly interconnected._