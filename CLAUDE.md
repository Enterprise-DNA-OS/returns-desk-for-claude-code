# Returns Desk for Claude Code: operating instructions

This is the internal returns desk for a retailer's operations lead. In a new installation ask for the business name, operator role and review priorities, then configure brand.json. The demo is fictional and must never be mixed with real records.

Read the relevant command before acting. Answers start with the CLI, not memory. Read case and item history before a change. Never guess an ambiguous ID, money value, customer choice or completed refund. Unknown is not zero. A carrier status is not a warehouse receipt.

## One path for each recurring job

| Ask | Command |
|---|---|
| Review every return and its outstanding work | `/returns` |
| Prioritise late returns, inspection work and unconfirmed remedies | `/attention` |
| Reconcile what has arrived against the expected units | `/receiving` |
| List received units still waiting for inspection | `/inspection-queue` |
| Review grading, quarantine and stock disposition evidence | `/dispositions` |
| Review product and return-reason patterns | `/reasons` |
| Review remedy decisions and external completion references | `/decisions` |
| Review consumer-rights evidence, safety holds and retention dates | `/compliance` |
| Review known goods value by currency and missing prices | `/value-at-risk` |
| Read the operator activity trail | `/history` |
| Read a return and its line balances | `/case` |
| Read a line and its receipt, inspection and assessment history | `/item` |
| Open a manually recorded return | `/add` |
| Record an expected return line | `/add-item` |
| Record a physical receipt with its unique dock reference | `/receive` |
| Record inspected units, condition and disposition | `/inspect` |
| Record the human consumer-rights assessment and customer choice | `/assess` |
| Record the agreed remedy after inspection and assessment | `/resolve` |
| Record evidence that the agreed remedy happened in another system | `/complete` |
| Close a return after every line is complete | `/close` |
| Cancel an unreceived return with a reason | `/cancel` |
| Change the owner and review dates | `/assign` |
| Append a return case note | `/log` |
| Import saved Narvar return payloads from an authorised merchant archive | `/import` |
| Write a new private JSON snapshot of all records | `/export` |
| Prepare an internal remedy summary without sending | `/draft-resolution` |
| Prepare the Monday returns review from three reports | `/weekly-review` |
| Show CLI usage | `/help` |
| Change a field or rule | `/customise` |
| Add a report | `/new-view` |
| Render paperwork | `/documents` |
| Render existing reports | `/views` |

## Limits

- Draft only. Nothing sends, buys labels, executes a refund or posts stock.
- Consumer rights require human assessment. Read docs/compliance.md before interpreting findings. Service targets and retention review dates are business policies, not statutory deadlines.
- Read docs/replace-narvar.md before an import. Use a fresh test database and --dry-run. Confirm currency and jurisdiction; do not infer them from locale or an email address.
- Every mutation uses the one CLI and an actor label. Never bypass failed quantity, quarantine or remedy checks with direct SQL.
- Preserve the evidence. Corrections are explicit amendments through tested migrations, never edits to applied migrations or deletion of receipt history.
- New production database access, sharing, deletion or external integrations require the operator's instruction. Never expose snapshots or reports publicly.

## Files

scripts/returns.mjs is the CLI. supabase/migrations contains ordered migrations, supabase/seed.sql the demo. .claude/commands has the recurring recipes. views.json and documents.json declare read-only output. brand.json controls names and colours. DATABASE_URL selects PostgreSQL; otherwise use the local PGlite DATA_DIR. OUTPUT_DIR redirects generated files for verification.

Any coding agent can follow these instructions. AGENTS.md points here. Installed and run through Omni by Enterprise DNA: https://enterprisedna.co/omni/instead-of/narvar.
