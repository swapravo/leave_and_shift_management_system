# Frontend — React + TypeScript + Vite

The single-page app for the pages in [LLD § Frontend](../../docs/02-low-level-design.md#frontend). It talks only to
the backend's `/api` (contract: [`docs/openapi.yaml`](../../docs/openapi.yaml)).

```bash
cd app/frontend
npm install
npm run dev          # http://localhost:5173 — proxies /api to the backend on :8000 (start that first)
npm run typecheck    # tsc
npm test             # Vitest unit tests
npm run build        # -> dist/, which the backend serves on its own port (single-port mode)
```

| Path | What |
|---|---|
| `src/main.tsx`, `src/App.tsx` | Entry and routes. Old addresses (`/leave`, `/approvals`, `/shifts`, `/admin/*`...) redirect to their new home, because stored notification links still use them |
| `src/auth.tsx` | `AuthProvider` (`/auth/me` on start), `RequireRole`, the "Not allowed" page |
| `src/api.ts` | The only HTTP client: same-origin `fetch` with the cookie; errors become `ApiError` with the backend `code` |
| `src/types.ts` | Types mirroring `openapi.yaml` (hand-written) |
| `src/dates.ts` | Pure date helpers on ISO strings; "today" always comes from the server |
| `src/swapOptions.ts`, `src/plain.ts` | Pure logic: which teammate shifts can be taken and why not; plain-language status and the step lists behind progress lines |
| `src/hooks.ts` | `useLoad` (fetch on mount / dependency change) and `useAction` (busy + error for writes) |
| `src/components/` | `Layout` (top bar on desktop, bottom tab bar on phones), `LeaveSheet` + `RangePicker` (request time off), `SwapSheet` (swap a shift), `Timeline`, approve/reject cards, shared UI |
| `src/pages/` | `Home` (per role), `Calendar` (tap a day to act), `Requests` (leave and swaps), `Inbox` (decisions, swap offers, updates), `Roster`, `Settings` (tabs: People, Teams, Leave types, Shift templates, Audit log), `Login` |
| `src/styles.css` | Design tokens: beige page, cream surfaces, orange for actions; yellow is a fill-only tertiary and never a text colour. One light theme, usable down to 360 px |

Navigation: employees get Home, Calendar, Requests, Inbox; managers add Roster; HR gets Home, Calendar, Roster, Inbox, Settings (managers reach Team settings from the account menu). Never more than five, so it fits a phone's tab bar.

Conventions: every status is shown as text (colour only reinforces it); form fields have labels; roster and
calendar cells carry `data-testid="cell-<shiftId>-<date>"` for the Playwright suite.
