# Move the internal returns records from Narvar

## Confirm the source before planning a switch

Narvar publishes a [standard RMA webhook specification](https://speca.io/Narvar/self-serve-rma). It describes JSON sent to a merchant integration. It is not documentation of a downloadable historical CSV export. Ask your integration owner for your authorised saved payload archive and confirm coverage, or agree a mapped extract with Narvar. An account without an archive needs that extraction work first. This repo does not contact Narvar or collect credentials.

Choose one reconciled payload per retailer and RMA. If your archive holds status updates for the same return, select the approved current snapshot with the integration owner and retain the event history separately. The importer rejects duplicate keys rather than guessing event order. Merchant-specific payload variants require reviewed mapping. Confirm line identifiers, amounts, currency and jurisdiction before loading production records.

## One command after the files are ready

Use Node 20 or newer. Install and migrate an empty working database, without demo seed data. A file may contain one standard object or an array of standard objects.

```sh
npm install
npm run migrate
npm run returns -- import narvar imports/returns.json --currency=NZD --country=NZ --owner=Mia --actor=Mia --dry-run
npm run returns -- import narvar imports/returns.json --currency=NZD --country=NZ --owner=Mia --actor=Mia
```

Keep the file under ignored imports/ and protect it. Currency and country apply to the whole file; separate batches when they differ. Country is the explicitly reviewed jurisdiction; origin_country and locale are not used to infer it. Sample policy dates are seven days for service and 365 days for a retention review. Agree your actual policies before using them. Use assign to change owner and review dates.

## Mapping

| Narvar fields | Owned records |
|---|---|
| retailer_name + rma_number | Stable case identity, unique across the pair |
| order_number, return_creation_date | Order reference and opened date |
| email | Customer label, or order reference when absent |
| return_tracking_status, return_method | Preserved source status and method |
| items.item_id, falling back to line_number | Stable line identifier within the return |
| sku, quantity, unit_price | Item, expected units and optional unit amount |
| reason, transaction_type | Reason and requested return or exchange |
| exchange_item.variant_sku | Requested exchange product reference |
| Every original field | Preserved original payload and original import text |

unit_price accepts nonnegative decimal amounts with up to two decimal places. Missing values remain unknown. Quantities must be positive whole numbers. Refund estimates, carrier delivery and source payment methods do not become a receipt, resolution or paid amount. Old package fields, shipments, addresses, attachments and custom fields stay in the raw payload for reconciliation but do not create operational records. No links are fetched.

The fixture under fixtures/ is synthetic data shaped from the published specification. It is not a vendor export or proof of a particular account's configuration. Unknown tracking statuses are preserved verbatim for review, never treated as completed work.

## Reconcile and cut over

Run returns, receiving, reasons and value-at-risk after import. Compare the source case count, retailer/RMA keys, quantities and currencies. The first import puts all cases in an open review state, even if the carrier says delivered or cancelled. Record warehouse receipt, inspection and human assessment from your actual evidence before resolving. Use log to retain reconciliation decisions.

Exact repeats do not duplicate cases. Changed existing records fail instead of overwriting operational history. A later bad row rolls back the whole file. Dry runs also roll back. Use an explicit reviewed correction or amendment when source facts change.

Keep Narvar and connected operational services until the agreed workflows work end to end. The free desk imports saved return data and runs internal review. Customer portals, live tracking, shipping labels, fraud services, refund execution and inventory updates require separately tested integrations. The available archive determines how much history can move in a day; there is no promise of a complete same-day platform replacement.

Export a private snapshot with npm run returns -- export exports/before-cutover.json. It includes every domain record, source payload and audit row. The destination must be new. JSON restore is not automatic, so keep a native database backup as well.
