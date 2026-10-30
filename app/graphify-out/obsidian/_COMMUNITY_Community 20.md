---
type: community
members: 21
---

# Community 20

**Members:** 21 nodes

## Members
- [[dot-balance()]] - code - backend/tests/conftest.py
- [[C5 Accrual & Balances.]] - rationale - backend/tests/test_accrual.py
- [[World]] - code - backend/tests/conftest.py
- [[cumulative()]] - code - backend/app/services/accrual.py
- [[monthly_credit()]] - code - backend/app/services/accrual.py
- [[parametrize_1]] - code
- [[round(Em12, 2) - round(E(m-1)12, 2) twelve credits always add up exactly…]] - rationale - backend/app/services/accrual.py
- [[test_accrual.py]] - code - backend/tests/test_accrual.py
- [[test_accrual_starts_in_the_join_month()]] - code - backend/tests/test_accrual.py
- [[test_adjustment_needs_a_reason_and_a_non_zero_amount()]] - code - backend/tests/test_accrual.py
- [[test_balances_visible_to_self_team_manager_and_hr_only()]] - code - backend/tests/test_accrual.py
- [[test_cannot_close_the_current_year()]] - code - backend/tests/test_accrual.py
- [[test_future_join_date_accrues_nothing_yet()]] - code - backend/tests/test_accrual.py
- [[test_hr_admins_get_no_balances()]] - code - backend/tests/test_accrual.py
- [[test_ledger_lists_every_movement_oldest_first()]] - code - backend/tests/test_accrual.py
- [[test_monthly_credit_examples()]] - code - backend/tests/test_accrual.py
- [[test_monthly_run_is_idempotent_and_rejects_future_months()]] - code - backend/tests/test_accrual.py
- [[test_new_leave_type_accrues_this_year_to_date()]] - code - backend/tests/test_accrual.py
- [[test_startup_catch_up_credits_january_to_this_month()]] - code - backend/tests/test_accrual.py
- [[test_twelve_monthly_credits_sum_exactly_to_the_entitlement()]] - code - backend/tests/test_accrual.py
- [[test_year_end_carries_forward_up_to_the_cap_and_the_rest_lapses()]] - code - backend/tests/test_accrual.py

## Live Query (requires Dataview plugin)

```dataview
TABLE source_file, type FROM #community/Community_20
SORT file.name ASC
```

## Connections to other communities
- 10 edges to [[_COMMUNITY_Community 13]]
- 4 edges to [[_COMMUNITY_Community 4]]
- 3 edges to [[_COMMUNITY_Community 7]]
- 2 edges to [[_COMMUNITY_Community 16]]
- 1 edge to [[_COMMUNITY_Community 31]]
- 1 edge to [[_COMMUNITY_Community 29]]

## Top bridge nodes
- [[World]] - degree 8, connects to 4 communities
- [[test_accrual.py]] - degree 18, connects to 3 communities
- [[monthly_credit()]] - degree 7, connects to 1 community
- [[dot-balance()]] - degree 7, connects to 1 community
- [[test_year_end_carries_forward_up_to_the_cap_and_the_rest_lapses()]] - degree 4, connects to 1 community