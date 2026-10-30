---
source_file: "backend/app/schema.sql"
type: "code"
community: "Community 32"
location: "L46"
tags:
  - graphify/code
  - graphify/EXTRACTED
  - community/Community_32
---

# users

## Connections
- [[audit_log]] - `references` [EXTRACTED]
- [[balance_ledger]] - `references` [EXTRACTED]
- [[birthday_grants]] - `references` [EXTRACTED]
- [[ix_users_team]] - `indexes` [EXTRACTED]
- [[leave_refund_days]] - `references` [EXTRACTED]
- [[leave_removed_shifts]] - `references` [EXTRACTED]
- [[leave_requests]] - `references` [EXTRACTED]
- [[notifications]] - `references` [EXTRACTED]
- [[schema.sql]] - `contains` [EXTRACTED]
- [[shift_assignments]] - `references` [EXTRACTED]
- [[swap_requests]] - `references` [EXTRACTED]
- [[teams]] - `references` [EXTRACTED]

#graphify/code #graphify/EXTRACTED #community/Community_32