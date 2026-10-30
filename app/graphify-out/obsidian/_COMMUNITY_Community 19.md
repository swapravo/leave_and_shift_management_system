---
type: community
members: 17
---

# Community 19

**Members:** 17 nodes

## Members
- [[C7 Roster and C9 Coverage Engine. Today is Wed 2026-06-10.]] - rationale - backend/tests/test_roster.py
- [[assign()_1]] - code - backend/tests/test_roster.py
- [[cell()_2]] - code - backend/tests/test_roster.py
- [[parametrize]] - code
- [[test_assign_and_unassign()]] - code - backend/tests/test_roster.py
- [[test_back_to_back_shifts_do_not_overlap()]] - code - backend/tests/test_roster.py
- [[test_cells_show_headcount_against_minimum()]] - code - backend/tests/test_roster.py
- [[test_copy_into_a_week_that_has_started_skips_past_days()]] - code - backend/tests/test_roster.py
- [[test_each_guard()]] - code - backend/tests/test_roster.py
- [[test_grid_shows_unscheduled_days_only_when_someone_is_assigned()]] - code - backend/tests/test_roster.py
- [[test_hr_can_edit_any_team_manager_only_their_own()]] - code - backend/tests/test_roster.py
- [[test_inactive_people_do_not_count()]] - code - backend/tests/test_roster.py
- [[test_my_shifts_defaults_to_the_next_28_days()]] - code - backend/tests/test_roster.py
- [[test_overnight_shift_overlaps_the_next_mornings_early_shift()]] - code - backend/tests/test_roster.py
- [[test_past_dates_are_read_only()]] - code - backend/tests/test_roster.py
- [[test_roster.py]] - code - backend/tests/test_roster.py
- [[test_roster_range_is_limited()]] - code - backend/tests/test_roster.py

## Live Query (requires Dataview plugin)

```dataview
TABLE source_file, type FROM #community/Community_19
SORT file.name ASC
```

## Connections to other communities
- 12 edges to [[_COMMUNITY_Community 16]]
- 7 edges to [[_COMMUNITY_Community 13]]
- 1 edge to [[_COMMUNITY_Community 29]]
- 1 edge to [[_COMMUNITY_Community 4]]

## Top bridge nodes
- [[test_roster.py]] - degree 19, connects to 4 communities
- [[test_each_guard()]] - degree 6, connects to 2 communities
- [[test_back_to_back_shifts_do_not_overlap()]] - degree 4, connects to 2 communities
- [[test_inactive_people_do_not_count()]] - degree 4, connects to 2 communities
- [[test_overnight_shift_overlaps_the_next_mornings_early_shift()]] - degree 4, connects to 2 communities