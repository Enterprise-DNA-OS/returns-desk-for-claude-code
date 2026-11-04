---
description: Import saved Narvar return payloads from an authorised merchant archive
---

# Import saved Narvar return payloads from an authorised merchant archive

Run `npm run returns -- import narvar <file.json> --currency=NZD --country=NZ|AU|unknown --owner= --actor= [--dry-run]`. All commands accept `--json` for machine-readable results.

Read the case or item history first. Use explicit identifiers when a name matches more than one record. Present the real output, keep unknown values visible and never add currencies together.

Get the operator's actual values and evidence. `--actor` is a supplied label, not an authenticated identity. Run the command only for the requested change, then read the record again. An error stops the whole transaction. Never write around a failed quantity or remedy check.

Read docs/replace-narvar.md. Run with --dry-run first, reconcile retailer, RMA, line counts and explicit currency, then import the same file. No Narvar export or API access is fetched by this command. Carrier delivery does not prove warehouse receipt.
