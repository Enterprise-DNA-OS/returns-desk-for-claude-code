---
description: Record inspected units, condition and disposition
---

# Record inspected units, condition and disposition

Run `npm run returns -- inspect <item> --quantity= --grade=sellable|damaged|unsafe --disposition=restock|quarantine|repair|recycle --evidence= --actor=`. All commands accept `--json` for machine-readable results.

Read the case or item history first. Use explicit identifiers when a name matches more than one record. Present the real output, keep unknown values visible and never add currencies together.

Get the operator's actual values and evidence. `--actor` is a supplied label, not an authenticated identity. Run the command only for the requested change, then read the record again. An error stops the whole transaction. Never write around a failed quantity or remedy check.
