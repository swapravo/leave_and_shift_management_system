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
| `src/main.tsx`, `src/App.tsx` | Entry and routes; `/` sends managers/HR to the dashboard, employees to My leave |
| `src/auth.tsx` | `AuthProvider` (`/auth/me` on start), `RequireRole`, the "Not allowed" page |
| `src/api.ts` | The only HTTP client: same-origin `fetch` with the cookie; errors become `ApiError` with the backend `code` |
| `src/types.ts` | Types mirroring `openapi.yaml` (hand-written) |
| `src/dates.ts` | Pure date helpers on ISO strings; "today" always comes from the server |
| `src/hooks.ts` | `useLoad` (fetch on mount / dependency change) and `useAction` (busy + error for writes) |
| `src/components/` | `Layout` (role nav, bell, mobile menu), shared UI (`StatusBadge`, `Modal`, `ErrorBox`, …), approve/reject controls |
| `src/pages/` | One file per page (F1–F12) |
| `src/styles.css` | Design tokens (CSS variables), light and dark, usable down to 360 px |

Conventions: every status is shown as text (colour only reinforces it); form fields have labels; roster and
calendar cells carry `data-testid="cell-<shiftId>-<date>"` for the Playwright suite.
