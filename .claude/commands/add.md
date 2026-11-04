---
description: Open a manually recorded return
---

# Open a manually recorded return

Run `npm run returns -- add --code= --retailer= --rma= --order= --customer= --country=NZ|AU|unknown --currency=NZD --owner= --opened=YYYY-MM-DD --due=YYYY-MM-DD --retention-due=YYYY-MM-DD --actor=`. All commands accept `--json` for machine-readable results.

Read the case or item history first. Use explicit identifiers when a name matches more than one record. Present the real output, keep unknown values visible and never add currencies together.

Get the operator's actual values and evidence. `--actor` is a supplied label, not an authenticated identity. Run the command only for the requested change, then read the record again. An error stops the whole transaction. Never write around a failed quantity or remedy check.
