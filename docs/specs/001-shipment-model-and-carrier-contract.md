---
id: "001"
title: Shipment model and carrier adapter contract
status: draft
---

# Shipment model and carrier adapter contract

## Context

Every input produces shipments, every carrier consumes them, every output reads the results. This
spec fixes the data model (`src/core/shipment.ts`) and the adapter contract
(`src/carriers/_contract/`) so that specs 002 to 008 build on one vocabulary. Decisions: ADR-0004.
The bootstrap skeleton already contains schemas and tests that mirror this draft; they change with
the spec until it is approved.

## Scope

In: the `Shipment` schema and its parts (`Address`, `Parcel`, `Item`, `Money`, `CustomsInfo`), the
EU membership rule for customs, the `CarrierAdapter` interface, `CarrierError` codes, `LabelResult`,
and the shared contract test suite. `CarrierContext` carries `signal` and an optional `onStage`
callback through which an adapter reports `submitting` and `capturing` to the runner (spec 004). Out: parsing rows (002), running the queue (004), saving files
(005), SKU profiles (006).

## Model

- `Shipment`: `orderId`, `recipient: Address`, `parcel: Parcel`, `items: Item[]` (at least one),
  optional `deliveryInstructions`,
  optional `shippingPrice: Money`, optional `customs: CustomsInfo`, optional `sourceRows`.
- `Address`: `name`, optional `company`, `line1`, optional `line2`, `line3`, `city`, optional `state`, optional
  `postalCode`, `countryCode` (ISO 3166-1 alpha-2), optional `phone`, optional `email`.
- `Parcel`: `weightGrams` (positive integer), optional dimensions in centimetres.
- `Item`: optional `sku`, `description`, `quantity` (positive integer), optional `unitPrice: Money`
  (the row input carries a total declared value, not unit prices), optional
  `unitWeightGrams`, `hsCode` (6 to 10 digits), `originCountryCode`.
- `Money`: `amount` in major units with at most two decimals, `currency` (ISO 4217).
- `CustomsInfo`: optional `declaredValue: Money` (the whole parcel, delivery included, as the
  row input gives it), optional `taxReference` (IOSS or similar), `category` (sale_of_goods, gift, commercial_sample, documents, returned_goods,
  other), `currency`, optional `explanation`, optional `invoiceNumber`. Declaration lines derive
  from `items`.
- `requiresCustomsDeclaration(shipment)`: true when `recipient.countryCode` is not an EU member.

## Acceptance criteria (EARS)

- **AC-001-1** The Shipment schema shall accept a shipment with one item and an EU recipient and no
  customs info.
- **AC-001-2** If an item quantity is zero, negative or not an integer, then the Shipment schema
  shall reject the shipment.
- **AC-001-3** The Shipment schema shall accept a non-EU shipment with several items and customs
  info carrying a category and a currency.
- **AC-001-4** When the recipient country is not an EU member state, `requiresCustomsDeclaration`
  shall return true; when it is a member state, it shall return false.
- **AC-001-5** Every carrier adapter shall expose `info` with an id matching `^[a-z0-9-]+$`, a
  strategy of `dom`, `http` or `api`, a non-empty name and at least one sender country.
- **AC-001-6** When `supports()` is called with any fixture shipment, the adapter shall return a
  verdict without throwing, with a non-empty reason when the shipment is unsupported.
- **AC-001-7** When `createLabel()` is called with a supported shipment, the adapter shall resolve
  to a `LabelResult` with a non-empty shipment number and PDF bytes, or reject with a
  `CarrierError`.
- **AC-001-8** If a money amount has more than two decimals, then the Shipment schema shall reject
  it.

## Open questions

- Weight unit in the export (grams assumed; `Package weight` could be kilograms).
- Are prices always in major units with a dot decimal separator?
- Which destinations require `state`, and does the export carry it reliably?
- Special territories outside the EU customs union (Canary Islands, Åland): customs or not?
- Sender details: configured once in the extension, or per row?
- Should `Shipment` carry the service to book, or does the adapter choose from weight and country?

## Test plan

- `src/core/shipment.test.ts`: AC-001-1, AC-001-2, AC-001-3, AC-001-4, AC-001-8.
- `src/carriers/_contract/testing.ts`, run by every `src/carriers/<id>/adapter.test.ts`:
  AC-001-5, AC-001-6, AC-001-7.
