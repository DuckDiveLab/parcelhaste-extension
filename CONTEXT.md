# CONTEXT.md: domain language

One line per term. Use these words in code, specs and docs. `(verify)` marks a definition the
maintainer has not confirmed yet.

## Shipping

- Shipment → one parcel to one recipient, built from one or more input rows that share an order id; `Shipment` in `src/core/shipment.ts`.
- Item → one product line in a shipment: SKU, description, quantity, unit price, optional weight, HS code and origin.
- Parcel → the physical package: weight in grams and optional dimensions in centimetres.
- Order id → the source system's identifier of the order; rows with `Multiple=TRUE` share one order id (verify: always consecutive rows).
- Recipient → the delivery address and contact: name, address lines, city, state, postal code, country code, phone, email.
- Sender → the shop shipping from Cyprus (EU); configured once in the extension, not per row (verify).
- Row → one tab-separated line copied from the maintainer's export tool; the provisional 22-column layout is in `fixtures/rows/`.
- Batch → the shipments loaded together; today one pasted row, later a dropped file (roadmap spec 008).
- Run → one execution of a batch against one carrier; `Run` in `src/core/queue.ts`.
- Queue → the ordered jobs of a run, executed one at a time in the side panel (ADR-0003).
- Job → one shipment moving through queued → filling → submitting → capturing → downloading → done, failed or skipped.
- Exception → a failed job a human handles; retries happen only for errors marked `retryable` (verify policy, spec 004).

## Carriers

- Carrier → a postal operator or courier with a web portal or API; one directory under `src/carriers/`.
- Carrier adapter → the module implementing `CarrierAdapter` for one carrier: `info`, `supports()`, `createLabel()`.
- Strategy → how an adapter talks to the carrier: `dom` fills the portal page, `http` replays the portal's own requests with the user's session, `api` calls an official API.
- Contract test → the shared suite in `src/carriers/_contract/testing.ts` that every adapter must pass.
- Portal → the carrier's logged-in website; for Cyprus Post the ePost portal (verify name and URL).
- Service → the product booked at the carrier, e.g. registered letter or tracked parcel, identified by the carrier's own code (verify Cyprus Post codes).
- Letter post vs parcel → Universal Postal Union categories: letter-post items (small packets up to 2 kg) and parcels use different forms and services (verify how Cyprus Post exposes them).

## Labels and customs

- Label → the PDF the carrier produces for a shipment; saved under Downloads as `ParcelHaste/<carrier-id>/<YYYY-MM-DD>/<order-id>_<tracking>.pdf`.
- Merged PDF → all labels of a run in one file for a single print job (roadmap spec 005).
- Customs declaration → the CN22 or CN23 required for destinations outside the EU customs territory.
- CN22 / CN23 → UPU customs forms; CN22 for low-value items on the label, CN23 as a full form above a value threshold (verify thresholds and Cyprus Post rules).
- Customs category → CN22/CN23 "category of item": sale of goods, gift, commercial sample, documents, returned goods, other.
- HS code → Harmonized System tariff code of an item, 6 to 10 digits.
- SKU profile → stored per-SKU customs data: weight, HS code, customs description, origin country (roadmap spec 006).
- Tracking number → an identifier the carrier tracks end to end, e.g. `RR…CY`; present only for tracked services.
- Shipment number → the carrier's identifier for any item, tracked or not; untracked items such as `UA…CY` have a number but no tracking (verify).
- Barcode → the printed form of the shipment or tracking number on the label.

## Project

- Input → anything that enters the extension: the clipboard row, later files (`src/inputs/`).
- Output → anything that leaves it: label files, the merged PDF, the tracking export (`src/outputs/`).
- Tracking export → the file uploaded to the marketplace for shipping confirmation (roadmap spec 007; needs an order-item id the export lacks).
- Fixture → synthetic test data under `fixtures/`; never real.
- Spec → `docs/specs/NNN-slug.md` with EARS acceptance criteria `AC-NNN-n`.
- ADR → a decision record in `docs/adr/`.
- Solution → a `docs/solutions/` entry: problem, what worked, what failed, gotchas, tags.
