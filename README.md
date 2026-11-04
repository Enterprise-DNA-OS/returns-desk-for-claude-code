# Returns Desk for Claude Code

Run the internal returns desk from records you own: expected units, warehouse receipts, inspections, customer choices and remedy evidence.

## Three ways to own it

- **Do it yourself:** the MIT-licensed base runs with Claude Code, Codex, OpenCode or Cursor. Hosting and agent subscriptions are separate.
- **We customise it:** Enterprise DNA brings across the agreed Narvar records, adapts your fields and rules, and builds the web front end, connections or different stack you need. One setup fee, then a retainer for ongoing work.
- **We run it for you:** Omni by Enterprise DNA installs your version and manages access, backups and the returns review. One setup fee, then a retainer.

[Book a 30-minute call with Sam](https://enterprisedna.co/omni/book/?offer=replace-software&utm_source=github&utm_medium=readme&utm_campaign=narvar).

## The annual bill

Vendr reports a US$38,395 median annual Narvar contract, checked 4 November 2026. This is an overall vendor benchmark, not a returns-only quote or a verified bill from a NZ or Australian business. Narvar's own product page directs buyers to a demo without a numeric price. Compare the work in your actual agreement before replacing it. Sources and candidate scores are in [research](docs/research.md).

## Start with the fictional demo

Node 20 or newer. No cloud account, carrier account or payment connection required.

```sh
npm install
npm test
npm run demo
npm run returns -- attention
npm run returns -- inspection-queue --json
npm run returns -- weekly-review
npm run view
npm run docs
```

Use a new DATA_DIR for real work. Do not seed a working business database. Seeding is idempotent and preserves existing rows. DATABASE_URL selects PostgreSQL. Without it, PGlite stores the database in .data/db. Dates use UTC.

The demo contains partial receipts, overdue cases, an exchange awaiting external fulfilment, unsafe goods and a missing price. All names and records are fictional. A carrier delivery event is never treated as a warehouse count. A remedy decision never becomes a completed refund without an operator recording evidence from the system where it happened.

## The weekly work

The desk has ten record types and five database views. Receive partial deliveries, inspect only received units, quarantine unsafe items, record the human assessment, then agree and confirm a remedy. Close only when every line is received, inspected and complete. Cancel only before any receipt or decision. Each mutation records an actor label and an activity entry in the same transaction.

The current workflow requires physical receipt and full inspection before a remedy. Keep-item returns and mixed remedies within one line require a reviewed custom workflow. A new assessment can supersede the previous assessment before a decision. Once a decision exists, evidence is append-only; corrections need an explicit amendment migration, not a hidden overwrite. Product prices are optional, unknown stays unknown, and totals keep currencies separate. Goods value is not an accounting liability or a refund estimate.

## Commands

| Command | Work |
|---|---|
| `/returns` | Review every return and its outstanding work |
| `/attention` | Prioritise late returns, inspection work and unconfirmed remedies |
| `/receiving` | Reconcile what has arrived against the expected units |
| `/inspection-queue` | List received units still waiting for inspection |
| `/dispositions` | Review grading, quarantine and stock disposition evidence |
| `/reasons` | Review product and return-reason patterns |
| `/decisions` | Review remedy decisions and external completion references |
| `/compliance` | Review consumer-rights evidence, safety holds and retention dates |
| `/value-at-risk` | Review known goods value by currency and missing prices |
| `/history` | Read the operator activity trail |
| `/case` | Read a return and its line balances |
| `/item` | Read a line and its receipt, inspection and assessment history |
| `/add` | Open a manually recorded return |
| `/add-item` | Record an expected return line |
| `/receive` | Record a physical receipt with its unique dock reference |
| `/inspect` | Record inspected units, condition and disposition |
| `/assess` | Record the human consumer-rights assessment and customer choice |
| `/resolve` | Record the agreed remedy after inspection and assessment |
| `/complete` | Record evidence that the agreed remedy happened in another system |
| `/close` | Close a return after every line is complete |
| `/cancel` | Cancel an unreceived return with a reason |
| `/assign` | Change the owner and review dates |
| `/log` | Append a return case note |
| `/import` | Import saved Narvar return payloads from an authorised merchant archive |
| `/export` | Write a new private JSON snapshot of all records |
| `/draft-resolution` | Prepare an internal remedy summary without sending |
| `/weekly-review` | Prepare the Monday returns review from three reports |
| `/help` | Show CLI usage |
| `/customise` | Add a field or reviewed rule through a tested migration |
| `/new-view` | Add a read-only report |
| `/documents` | Render receipt and remedy paperwork |
| `/views` | Render the three existing reports |

Every read supports --json. Case and item references accept a code, case-insensitive name or ID prefix. Ambiguous matches list candidates and exit 1. Run npm run returns -- help for exact arguments. Mutations require --actor and their documented evidence. Unknown options and malformed amounts or dates fail.

## Ten questions to ask your records

1. Which late returns still have missing units? (`attention`)
2. Which received items are waiting for inspection? (`inspection-queue`)
3. Which unsafe goods remain in quarantine? (`dispositions`)
4. Which major defects still lack a recorded customer choice? (`compliance`)
5. Which remedy decisions lack external completion evidence? (`decisions`)
6. Which products are returning for the same reason? (`reasons`)
7. Which exchange requests are associated with sizing issues? (`reasons`)
8. What is the known returned-goods value in each currency, and what is unknown? (`value-at-risk`)
9. Which personal return records have reached their retention review date? (`compliance`)
10. Who recorded each receipt, assessment and remedy? (`item`)

Each question has a working read in this base. We have not verified that Narvar cannot answer these questions; the difference is that you can change the joins, checks and evidence rules in your own system.

## Your first hour: ten things to ask for

1. Put our name, colours and logo in brand.json.
2. Show the returns that are overdue.
3. Count the units still missing at the warehouse.
4. List received units that nobody has inspected.
5. Show every unsafe item and its quarantine evidence.
6. Find major defects still missing the customer's choice.
7. Prepare a remedy review with the external completion references.
8. Test the saved Narvar payload import in a fresh database.
9. Set our service and retention review dates through a reviewed change.
10. Export a private snapshot before changing a rule.

## Bring your history

[Move from Narvar](docs/replace-narvar.md) describes a one-command offline import of saved standard RMA webhook JSON. This is not a claimed Narvar CSV export, and it does not fetch records from Narvar. Confirm you have the merchant payload archive or arrange a mapped export before promising a switch in a day. The synthetic fixture follows the published field names; it is not a captured customer export.

Dry runs roll back. Exact repeated source records are harmless. Changed existing records, repeated RMA keys and duplicate item identifiers stop the whole transaction. Original payloads and source text are preserved for reconciliation, including private customer fields. Back up and protect snapshots. Historical webhook events for the same return must be reconciled into one approved snapshot before import. Live event ingestion is separate integration work.

## Documents and views

npm run docs renders a receipt and inspection record and a remedy review for every case under docs-out. npm run view writes week, warehouse and product-reason reports under views. All are read-only HTML and can be printed to PDF. Edit brand.json for the business name, colours and logo. Draft summaries stay in drafts and never send. The core is useful as a trusted operator's desk without a customer portal.

[Compliance checks](docs/compliance.md) support evidence review. [Why no front end](docs/why-no-front-end.md) explains the operating scope and the connections a complete replacement needs.

## Verification and access

npm test uses a temporary database and exercises all 28 CLI commands, repeat seed and migration runs, partial receipts, over-receipt rejection, unsafe-stock controls, remedy evidence, duplicate and conflicting imports, rollback, private snapshots, CLI failures and escaped HTML. CI can run on Windows and Ubuntu with Node 20 and 22 and on PostgreSQL 17. TEST_DATABASE_URL must point to an empty disposable database. Hosted checks are reported separately from configuration.

This is a trusted-operator tool. It has no sign-in, customer portal, live carrier feed, fraud intelligence, label purchasing, payment execution or inventory posting. Actor names are labels, not authenticated users. Row-level security and revoked PUBLIC privileges deny ordinary public database access; the database owner can bypass those protections. CLI mutations serialise through a table lock. Direct database-owner SQL can bypass application rules. Configure access, encrypted backups and retention before importing real data. Export is a complete JSON snapshot, not an automated restore tool; keep native database backups too.

## Licence

MIT. Copyright 2026 Enterprise DNA. Narvar and other product names belong to their owners. No vendor code or customer data is included.
