# Leave & Shift Manager

Leave requests, balances, shift roster, shift swaps, approvals, team calendar, manager dashboard, audit log and notifications.
Zero dependencies: Node.js 22.13+ only (uses the built-in `node:sqlite`).

## Run

    cd demo/cold-open-app
    npm start            # http://localhost:3000  (first start creates data/app.db with demo data)
    npm test             # API test suite (in-memory database)
    npm run seed         # wipe data/app.db and reload the demo data

Environment: `PORT` (3000), `HOST` (127.0.0.1), `DB_PATH` (data/app.db), `APP_TODAY=YYYY-MM-DD` (pretend today's date).

## Demo accounts (password `password123`)

| Role | Email |
| --- | --- |
| HR admin | helen.park@example.com, hugo.alvarez@example.com |
| Manager (Support) | maria.santos@example.com |
| Manager (Operations) | daniel.okafor@example.com |
| Employees | aisha.khan, ben.carter, chloe.nguyen, diego.ramos, emma.fischer (Support); farid.hassan, grace.liu, henry.adams, isla.murphy (Operations), all @example.com |

## Rules worth knowing

- Leave days count Mon-Fri, excluding public holidays; half days are single-day only. Balances are per calendar year and include carry-over and manual adjustments.
- Pending requests reserve balance. Approvers are the person's manager (HR admins if none). Nobody can approve their own request.
- Approving leave over rostered shifts asks for confirmation, then releases those shifts. Shifts cannot be created on approved leave, may not overlap, and need 8 hours rest between them.
- Swaps: requester proposes (swap or "cover my shift") to a department teammate, the teammate accepts, then a manager/HR approves and the shifts change hands.
- The audit log is append-only (enforced by database triggers) and visible to HR admins, who can export it as CSV.
