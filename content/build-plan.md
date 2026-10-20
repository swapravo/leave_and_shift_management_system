# Build plan: the demo app, topic by topic

The Leave & Shift Management System is built live across the five days, one step per topic. It is never built all at once. F1–F9 are the BRD's numbered features.

The order: setup and guardrails on Day 1, small features and specs on Day 2, the full design pipeline on the leave feature on Day 3, the shift features and integrations on Day 4, and docs, tests and team conventions on Day 5.

## Day 1: Mindset & setup (nothing real is built yet)

| Topic | Step of building the app | Why at this step | Meta things in / around this step |
|---|---|---|---|
| 1 | **Cold open:** type "Add shift swap requests to the app" into an empty repo | With no repo at all, Claude decides everything: stack, schema, roles. Swap (F4) depends on the roster, leave and coverage, so it produces the most unasked-for decisions. | Run it on a throwaway branch. Don't merge it and don't delete it: you reopen it at T31. Have the class list every decision it made. A reference run lives in `demo/` on the `claude/bold-gauss-6bzbzk` branch. |
| 2 | Use an RTF prompt to produce a **domain glossary** → `docs/glossary.md`: roles, entities, leave-request and swap states | The first useful output, with zero code. Format is shown as a table skeleton. | Put T1's prompt next to its RTF rewrite. The glossary goes into CLAUDE.md at T8. |
| 3 | Claude reads the BRD and glossary and summarises them | The task is read-only, so the read-plan-act-observe loop is visible without any file changes. | Run `/context` before and after. |
| 4 | **Feature dependency map** of F1–F9, run once on a fast model and once on a larger one | Dependency mapping is easy enough that the fast model does fine, which teaches over-serving. The map also sets the build order for the whole course. | Save as `docs/build-order.md`. Switch models live with `/model`. |
| 5 | Human sign-off on the build order, plus a "stays human" list: the accrual rule, minimum headcount, approval policy | The review role in practice. Business policy isn't Claude's call. | Add a "decision owner" column to `build-order.md`. |
| 6 | **Synthetic seed-data policy**: fake names and emails only, add `.env.example`, git-ignore `.env` | This has to be settled before any seed script exists (T12). The BRD says the data is seeded. | Write the policy into CLAUDE.md at T8. Deny reads of `.env` at T9. |
| 7 | **Scaffold the real repo** (`git init`, app boots, test runner runs) and show it in the terminal, web and desktop interfaces | CLAUDE.md needs a real repo to describe. | Choose the stack in advance and keep it boring. It becomes ADR-000 at T26. Pre-install all dependencies. |
| 8 | `/init`, then hand-edit **CLAUDE.md**: stack, run and test commands, folder layout, glossary link, seed-data rule | The Day 1 checkpoint asks people to read "the one just written for today's app". | Land CLAUDE.md through a PR, so it gets reviewed like code. |
| 9 | Write **`.claude/settings.json`**: allow test, lint and dev; ask before `git push` and migrations; deny `.env`, `rm -rf` and DB reset | The rules need to be in place before any real building on Day 2. | Trigger one denied action live. |
| 10 | Add a `/pr-checklist` command (from the course's prompt sketch) and optionally `/reseed` | It gets used on every PR from Day 2 onward. | Commit it to `.claude/commands/`. |
| Git safety net | Branch per task, commit at every green point, tag `day1-end` | This is the last thing before building starts. | **Tag a checkpoint per topic** (`t11-end`, …) so students who fall behind can check one out. |

## Day 2: Workflow, ADLC & specs

| Topic | Step of building the app | Why at this step | Meta things in / around this step |
|---|---|---|---|
| 11 | **Leave types CRUD** (the HR Admin config part of F1): run with Plan Mode off, then on, and edit the plan | It's the smallest, least ambiguous and most foundational feature, so a plan can be judged without a spec, and specs haven't been taught yet. | Do the Plan-Mode-off run on a throwaway branch. Edit one plan step live (e.g. "add a test for a duplicate name"). Run `/pr-checklist`. |
| 12 | **Org seed data**: departments, teams, employees, managers (synthetic, per T6), done in a fresh session | A mechanical task that suits a clean context after T11's long session. Every later feature needs people. | Run `/context` at the end of T11, then `/clear`. Demo `claude --resume`. |
| 13 | Use a research subagent ("how are leave types stored and validated?") and a review subagent on the T11–T12 diff | This topic is explanation only, and the code is still small enough to check the subagent's report against. | Show that the main context only gets the summary back. |
| 14 | **Skill `add-endpoint`**: route, validation, error shape and test, per CLAUDE.md conventions | The pattern has now come up twice (T11 and T12), and every later feature reuses it. | Save as `.claude/skills/add-endpoint/SKILL.md`. Reused at T27 and T38. |
| 15 | Compare low and high reasoning effort on "how do we enforce minimum coverage when leave is approved or a swap is accepted?" | This is the hardest design question in the BRD (F5). Think about it early, decide it later. | Save both answers to `docs/adr/drafts/`. They become ADR-001 at T26. |
| 16 | Map the remaining build onto the ADLC phases. Create `docs/specs`, `docs/design`, `docs/adr` and `docs/tasks` | Gives a home to everything Days 2–3 produce. | Optionally add `docs/build-log.md` mapping each topic to its commit or tag. |
| 17 | Problem statement → **spec draft for leave balance + apply/approve** (F1 + F2) | This is the core of the app and BRD success criterion 1. Leave types and org data already exist. | Show the vague version and the spec side by side. |
| 18 | Clarifying questions on "let people swap shifts" (F4); record the answers | Swap is the vaguest feature, and the answers expose its dependencies on the roster and coverage. | You answer as "the business". Save to `docs/specs/swap-questions.md` as input for T21. |
| 19 | Rewrite the leave spec in **SPEC** form. Example: "balance 10, apply 2, balance 8". Constraints: single manager approval, one accrual rule | Formalises T17 before the Day 3 tools consume it. | Save as `docs/specs/leave.md`. Tag `day2-end`. |

## Day 3: Spec frameworks, decomposition & architecture

| Topic | Step of building the app | Why at this step | Meta things in / around this step |
|---|---|---|---|
| 20 | Run **Spec Kit** on the leave SPEC: constitution (from CLAUDE.md) → specify → plan → tasks. Stop before implement | It turns the hand-written SPEC into a gated, repeatable workflow. | Pre-install the `specify` CLI. Compare its output with T19 by hand. |
| 21 | **BMAD in planning mode only** for shifts (roster F3 + swap F4): PRD, architecture options, story files | It uses the T18 answers. Running the second framework on a different feature lets the class compare the two. | Pre-install BMAD. **Choose which framework is the house process** and write that into CLAUDE.md. |
| 22 | **HLD for the whole system** (all nine modules and who talks to whom), then **LLD for the leave module only** | There are now enough specs to draw boundaries. LLD is only for what gets built next. | Save as `docs/design/hld.md` and `lld-leave.md`. Flag the coverage boundary as unresolved; T26 settles it. |
| 23 | **Decomposition pipeline** for leave: data model (types, balances, accrual ledger, requests) → API contract → leave screens scaffolded **in parallel** from the contract | Leave is fully bounded now, which makes it a clean demo of the parallel-frontend rule. | Run the frontend in a second session or worktree that's told not to read the backend. Lock the contract in `docs/design/api-leave.md`. |
| 24 | Self-checkable **acceptance criteria** for leave, including BRD success criterion 1 | They have to exist before the tasks, so each task has a done-check. | Write them as Given/When/Then so they map 1:1 to tests at T41. |
| 25 | Split leave into **one-sentence tasks** | This is the pipeline's output. | Save to `docs/tasks/leave.md`. They become GitHub issues at T32. |
| 26 | **ADR-001: coverage enforcement** (from the T15 drafts), plus ADR-000 for the stack, written after the fact | It has to be decided before the leave approval code touches coverage, and before shifts exist. | Save in `docs/adr/` and update the HLD. |
| 27 | **Implement the leave tasks** one at a time, @-mentioning only the files each task needs, using the T14 skill | The first real feature build. Everything before it was preparation. | Do 1–2 tasks live and pre-build the rest on a branch (`t27-end`). Show what goes wrong if you @-mention all of `src/`. Tag `day3-end`. |

## Day 4: Recon, precision & MCP

| Topic | Step of building the app | Why at this step | Meta things in / around this step |
|---|---|---|---|
| 28 | Fresh session, **read-only recon of our own app** as a new joiner → `docs/architecture.md`, compared against the HLD | The app now has enough code to feel unfamiliar. Doubles as a check for drift between design and code. | Use Plan Mode or read-only permissions. |
| 29 | Parallel subagents explore a **large open-source HR repo** (e.g. Frappe HRMS) for how it models shift assignment and leave/shift conflicts | Our repo is far too small for "100k+ lines". This also gives a design reference just before shifts get built. | Shallow-clone it before class. Keep it read-only and check the licence before borrowing ideas (ties back to T6). |
| 30 | Build the **shift roster builder** (F3) from the BMAD story files, with precision verbs plus "do not touch the leave module or existing migrations" | The first feature built alongside existing code, which is where negative constraints start to matter. | Do one run without the boundary and show the diff it causes. |
| 31 | Build **shift swap requests** (F4). Treat the first output as a draft and name specific fixes: swapping with someone on leave, cross-team swaps | Swap's edge cases are exactly where first drafts go wrong. | **Reopen the T1 cold-open branch** and compare the decisions it made. |
| 32 | Connect the **GitHub MCP server** (optionally also a DB MCP server) and create issues from the remaining tasks | T33 needs this outside reach. | Set up auth before class. Commit `.mcp.json` without secrets. |
| 33 | **Issue → PR: coverage validation** (F5) per ADR-001, wired into leave approval and swap acceptance. This is success criterion 2 | It needs leave, roster and swap all in place. | Use the DB MCP server to check the seeded coverage data. The PR runs `/pr-checklist`. |
| 34 | **Figma frame → manager dashboard** (F7): pending approvals, today's coverage gaps, team availability. This is success criterion 3 | All the data it displays now exists. | Prepare the Figma file and design tokens in advance, and set up Figma MCP auth. |
| 35 | Build the **unified team calendar** (F6) and land it as clean atomic commits, splitting out any refactors nobody asked for | UI work tempts Claude to touch shared components, which is ideal commit-hygiene material. | Show `git add -p` or the split-commits prompt. Tag `day4-end`. |

## Day 5: Docs, SOPs, debugging & guardrails

| Topic | Step of building the app | Why at this step | Meta things in / around this step |
|---|---|---|---|
| 36 | **API reference docs** generated from the API layer, plus a README update | All the main endpoints exist now. | Review the docs against the code. Add a docs check to `/pr-checklist`. |
| 37 | Turn a real Day 4 debugging session into an **SOP** (e.g. "coverage check broke the swap flow"), or else the recurring "reset and reseed the demo DB" workflow | It needs a session that actually happened. | Keep the Day 4 transcripts (`claude --resume`). Save SOPs in `docs/sop/`. |
| 38 | **Package the SOP as a skill** | It follows straight on from T37. | Revisit the T14 skill alongside it. |
| 39 | Extract a **starter kit** (CLAUDE.md, settings, commands, skills, `docs/` layout) into a template repo | After four days the conventions are stable. | Make it a separate GitHub template repo. |
| 40 | **Debug a planted bug**: the carry-forward cap is off by one at year rollover (F1). Reproduce → isolate → diagnose → fix → verify | Date and accrual logic is the realistic class of bug in this app. | Plant the bug in advance and keep a `pre-fix` tag. |
| 41 | **Generate tests** for accrual and coverage, review the assertions, and write all three BRD success criteria as tests | It comes after the bug, so it can show the main trap. | Generate tests at the `pre-fix` tag and show one confidently asserting the buggy value. |
| 42 | **Audit log** (F8): an append-only table, plus a **guardrail test or hook** that fails if any write endpoint skips the audit entry. Add a pre-commit hook | The audit log is the app's own guardrail, and the check that enforces it is the course's kind of guardrail. | Use a Claude Code hook or a git pre-commit hook that runs tests and lint. |
| 43 | Write `docs/conventions.md`. **Capstone:** students build **notifications** (F9) using only the starter kit and the conventions | It proves the conventions carry over to other people. | Students work in pairs. Keep your own version on a branch for reference. |

## Open decisions

- **Stack (T7):** fix it before Day 1 rather than make it a live decision.
- **House process (T21):** Spec Kit or BMAD. After T21 only one of them should carry forward.
- **Day 4 load:** Day 4 has six build steps (T30, T31 and T33–T35). Pre-build the calendar (T35) or the dashboard (T34) on a branch and only demo the topic step live.
