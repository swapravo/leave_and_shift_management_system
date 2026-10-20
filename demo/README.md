# Cold-open demo: what a vague prompt builds

`cold-open-app/` was built by a Sonnet subagent from a single loose prompt, with no plan, no spec, no CLAUDE.md and no follow-up questions allowed to reach a human. It is kept as teaching material for **Topic 1 (the plan/do gap)** and as the "before" picture for **T31 (shift swaps, first output as draft)**. It is not the course app and should not be extended.

## The entire prompt

> Build a leave and shift management app. Employees should be able to apply for leave and swap shifts with teammates, managers approve things and see their team, and HR admins set up leave types. It should have leave balances, a shift roster, a team calendar, a manager dashboard, an audit log and notifications. Make it work.
>
> Put everything in /home/user/leave_and_shift_management_system/demo/cold-open-app/ and work only inside that folder. Don't commit anything to git. When you're done, tell me how to run it.

It is a paraphrase of the BRD with the parts that carry intent removed: the objective, the scope limits, the out-of-scope list and the success criteria.

## Run it

Node 22.13+, no dependencies.

```
cd demo/cold-open-app
npm start        # http://localhost:3000, every demo account uses password123
npm test         # 13 tests, in-memory DB
```

## The point

It looks done. It has 4,100 lines, three roles, 13 green tests, a polished UI, CSRF protection and an append-only audit log enforced by triggers. Fluent output, in other words.

**It doesn't do the one thing the BRD exists for.** The objective is "one place to manage leave and shifts, where a coverage gap can't slip through unnoticed." The app has no minimum-headcount rule anywhere. When a manager approves leave that clashes with rostered shifts, the app offers **"Approve and release them?"** and then *cancels those shifts*. Nobody is assigned in their place and nothing is flagged as a gap. The workflow that creates coverage gaps is the one the app made smooth.

See [cold-open-review.md](cold-open-review.md) for every decision it made on its own.
