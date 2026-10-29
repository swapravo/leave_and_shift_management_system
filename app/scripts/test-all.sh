#!/usr/bin/env bash
# Every suite, in order, stopping at the first failure (D-005: must pass before every push).
#   pytest -> typecheck -> vitest -> build -> playwright
set -euo pipefail
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

echo "== backend: pytest"
(cd "$ROOT/backend" && .venv/bin/pytest -q)

echo "== frontend: typecheck"
(cd "$ROOT/frontend" && npm run --silent typecheck)

echo "== frontend: vitest"
(cd "$ROOT/frontend" && npm test --silent)

echo "== frontend: build"
(cd "$ROOT/frontend" && npm run --silent build)

if [ -d "$ROOT/e2e" ]; then
  echo "== e2e: playwright"
  (cd "$ROOT/e2e" && npx playwright test)
else
  echo "== e2e: app/e2e doesn't exist yet (the Playwright suite is the next build step)"
fi

echo "All suites passed."
