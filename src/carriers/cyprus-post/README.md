# Cyprus Post (ePost) adapter

Status: scaffold. Strategy: `dom` on the ePost wizard, then `http`. The official API (see
"Official API" below) is not used by this extension: it belongs to the separate ParcelHaste server
gateway, and the extension covers the cases where that API cannot be used. Spec:
`docs/specs/README.md`, spec 003.

## Fixtures for spec 003

All fixtures go under `fixtures/carriers/cyprus-post/` and must be sanitized: no real
names, addresses, phone numbers, emails, account numbers, session cookies or tokens.
How to capture and sanitize them: `docs/portal-capture.md`.

| File | What it is | Status |
|---|---|---|
| `create-label.fields.json` | Form inventory of the guest wizard (all 6 steps are in one form), no values | captured 2026-10-18 |
| `countries.json` | Destination list: portal country id ↔ name (248 entries) | captured 2026-10-18 |
| `services-by-country.json` | Allowed services, HS-code flag and postcode formats for 41 destinations | captured 2026-10-18 |
| `services.md` | Services, sizes, options and the rules between them | written 2026-10-18 |
| `create-label.empty.html` | The guest wizard after load, step 1 | captured 2026-10-18 |
| `create-label.filled.html` | The guest wizard at step 6 with a synthetic shipment to GB (Letter E, 0.6 kg, Recorded Delivery) | captured 2026-10-18 |
| `notification.error.html` | The error notification after Next on an empty step 1 | captured 2026-10-18 |
| `login-required.html` | What an expired session shows | needs a logged-in session |
| `create-label.errors.html` | The page after the server rejected a submit | needs a real submit |
| `confirmation.html` | The page after a successful submit | needs a real submit |
| `label.pdf` | A label PDF | needs a real submit |
| `submit.har` | The Create request/response | needs a real submit |

## Portal facts

Verified on the guest wizard (`/one-time-customer`, no login) on 2026-10-18 unless marked
otherwise. Public sources were read the same day.

### Pages and login

- Portal: `https://epost.cypruspost.gov.cy/` (`info.portalMatches`: `https://epost.cypruspost.gov.cy/*`).
  ASP.NET MVC, jQuery 1.12.4, Kendo UI 2023.1.117, intl-tel-input, behind an F5 BIG-IP.
- The create-item wizard ("Create Item Shipment", the "eCustoms tool") works as a guest at
  `/one-time-customer`. Logging in adds saved senders and recipients, a content-piece catalogue and
  the Item Dispatch Catalog (reprint, edit, cancel, pay, export). The logged-in wizard has not been
  captured yet.
- `/login` redirects to CyLogin: `https://cge.cyprus.gov.cy/cylogin/core/login?signin=…`.
- The old standalone Shipping Tool (`shipping.cypruspost.post`) was replaced by this ePost wizard,
  office by office, between 13 Oct and 1 Dec 2025
  (https://shipping.cypruspost.post/Content/uploads/8e1d370653.pdf). The label and the customs
  declaration come out of the same wizard; there is no separate customs step.
- An electronic shipment request is mandatory for EMS, parcels, Interconnect and any registered or
  recorded item with goods, to every destination, and for plain small packets outside the EU
  (https://www.cypruspost.post/en/shipping-tool). Items covered by the mandate are refused at the
  counter without it.
- Items not handed in within 30 days of creation are deleted. Payment is optional at creation
  (`BL_ADD_ITEM_TO_CART`); otherwise at the counter.

### The wizard

One Kendo Wizard `#customDeclarationWizard` inside one form `#CreateCustomsDeclaration`. Validation
runs in the wizard's `select` handler when moving forward; earlier steps lock once passed.

| Step | Contents | Server calls |
|---|---|---|
| 1 Item details | Nature of item (`NSALE` sale of goods, `NRTRN` returned goods, `NGIFT` gift, `NCOMM` commercial sample, `NDOCS` documents, `NOTHR` other + explanation ≤ 50 Latin chars); accompanying documents (`DCRT`, `DINV`, `LABL`, `DLIC`); destination country; gross weight kg (3 decimals, ≤ 30); service; letter size | `GetServiceByCountryID`, `GetPostalCodesFormat`, `/Home/ValidateSelectedService`, `/Home/ReadItemOptions` |
| 2 Options | Priority and additional services with live prices (`services.md`) | `/Home/CheckSelectedItemOption` and `ReadItemOptions` on every toggle |
| 3 Content pieces | Per line: description, HS code, manufacture country, quantity, unit amount (€), unit weight (kg) | `ZephyrQuickHS6` for the HS lookup only |
| 4 Sender | First and last name, ID reference, email, phone, fax, company, Cyprus address from lookups | `/Senders/GetPostalCodes`, `/Senders/FindAddress` |
| 5 Addressee | Same fields; country fixed to the destination; free-text postcode, town and street | none |
| 6 Confirmation | Three required confirmations, add-to-cart, cost summary, **Create** | `/Home/CheckCustomsSummary` |

- **Create** is an AJAX POST of the serialized form to `/OneTimeCustomer/CreateCustomsDeclaration`,
  with the options appended as `ITEM_OPTIONS[n].ProductId` and content pieces as
  `CONTENT_PIECES[i].*`. No anti-forgery token. On success the page shows the reference number,
  the server-generated barcode and the expiry date; there is no redirect (read from the page
  script, not yet observed).
- The label PDF comes from `/ReportViewer/BuildReportURL` with
  `{ParamDictionary:{item:<UI_ITEM_GUID>},ReportType:"Single",ReportName:"Label"}` (or
  `"StickerLabel"` for A6), which returns a URL opened in a new tab (read from the page script).
- Destinations use portal ids, not ISO codes (`countries.json`, e.g. 236 United Kingdom, 238 United
  States). Names follow ISO 3166 short names. Three destinations have no ISO code of their own:
  251 Canary Islands, 252 Ceuta and Melilla, 121 Kosovo.

### Rules the adapter must respect

- **Goods never go Registered internationally.** Since 1 Jan 2026 the Registered option requires
  nature `NDOCS` for any destination but Cyprus; goods use Recorded Delivery (portal note; the last
  day for goods by registered mail was 19 Dec 2025, https://www.cypruspost.post/en/news/anakoinosi).
  The wizard enforces it.
- **Services depend on the destination** (`services-by-country.json`): e.g. Parcel is not offered
  to DE, FR, ES, NL, PL, IE, GB, NO, IS or the Canary Islands; Interconnect Premium only to the EU,
  GB, CH, NO and IS. `supports()` cannot be decided from the shipment alone.
- **Customs territory is the portal's, not the EU list.** The HS field is enabled exactly for
  destinations outside the EU customs territory, including the Canary Islands. A Spanish address
  with a 35xxx/38xxx postcode must be booked to destination 251, not Spain.
- **Content pieces** are required unless the item is a letter with nature `NDOCS`, and always for
  the US. At most 999. Description: English only, 3 to 256 characters, at least one letter, allowed
  `a-zA-Z0-9. -_?,/'+@!()~{}|`; an apostrophe truncates the posted value (page bug). Unit amounts
  are in **euros only**. Total net weight ≤ 30 kg and ≤ the gross weight.
- **HS codes** are 6 to 10 digits; documents must use `491199`. The web field is read-only and only
  filled by `ZephyrQuickHS6?hsCodeText=<description>&destination=<id>`, an automatic classifier
  that always answers (even `xqzv` gets `851713`). The grid accepts any 6–10 digit code set by
  script. The API validates codes server-side through Zonos for non-EU destinations; whether the
  web form's Create does the same is not yet known.
- **Names are split** into first and last name, each ≤ 50 characters in the form; the addressee's
  first + last must be ≤ 35. The API documents sender first name ≤ 20 and last name ≤ 30.
- **Addressee contact:** phone or email is required; Interconnect Premium needs both. EMS and
  Interconnect need a sender email.
- **Addressee address:** street ≤ 50, No ≤ 10, Flat/Off. ≤ 10, Building ≤ 50, town ≤ 32, region
  ≤ 50, postcode ≤ 10 (`[A-Za-z0-9- ]`). There is no second address line; `line2` has to go into
  Building or Flat. The country's postcode format is shown as a hint, and the API rejects postcodes
  that do not match it (`NW16XE` rejected, `NW1 6XE` accepted).
- **Phones** are checked with intl-tel-input (libphonenumber). The fixture range
  `+44 7700 900xxx` is reported as an invalid Jersey number, so synthetic fixture phones fail the
  portal's check.
- **The sender must be in Cyprus**: postcode and street must be chosen from the portal's lists
  (1279 postcodes; streets per postcode from `FindAddress`).
- **US:** shipments resumed on 27 Apr 2026 with duties calculated by ePost and paid by the sender
  (https://www.cypruspost.post/en/news/επανέναρξη-αποστολών-ταχυδρομικών-αντικειμένων-για-ηπα).
  `CheckCustomsSummary` returns `extraCharges {duties, taxes, surcharges}`.

### Automating the wizard (`dom`)

- The widgets are Kendo: values must be set through the widget API
  (`$(el).data("kendoDropDownList").value(x)` then `.trigger("change")`), which only works in the
  page's MAIN world (`chrome.scripting.executeScript({ world: "MAIN" })`), not from an isolated
  content script.
- Order matters: destination → wait for the services call → weight → service and size → wait for
  the options list (clicking Next while it is empty silently skips step 2) → options one at a time,
  waiting for each re-render → content pieces → sender postcode → wait for `FindAddress` → street.
- Errors arrive as Kendo notifications (`.k-notification`, auto-hide after 8 s) and Kendo dialogs
  (`.k-dialog`), never native dialogs. The notification `#notification` has four templates, told
  apart by the inner class: `.error-msg` (validation, `notification.error.html`),
  `.error-create-msg` (a failed Create), `.success-msg` and `.info-msg`; each has an `h3` title
  and a `p` message, except success, whose message is the `h3`.
- The page's message catalogue is in hidden inputs named `hidden…` (e.g.
  `hiddenCompleteMandatoryFields`, `hiddenDocumentRegisteredError`), all in
  `create-label.empty.html`, so the adapter can match messages against the page's own text.
- Next is `#ItemNextButton` (`data-wizard-next`). Kendo gives radios, checkboxes and popups random
  GUID ids on every load: select by `name` and `value`, never by those ids. In the HTML fixtures
  they are replaced by `kendo-uid-N`, consistently within each file.
- Typed values are DOM properties, not attributes, so they are not in `create-label.filled.html`;
  the content-piece grid row, the selected street in its list and the step-6 cost summary
  (€9.90) are; names and addressee fields are not. The values used were: sender Test Sender,
  1 Ariadnis, 1010 Lefkosia; addressee Second Tester, 2 Sample Road, Flat 3, London SW1A 1AA; one
  piece "Plastic car phone holder", HS 392630, made in China (46), 2 × €12.50, 0.2 kg each.

### Testing against the fixtures

The sanitizer strips every `<script>`, including Kendo's templates, so in a fixture the widgets are
dead markup: tests can check page detection, selectors and the shipment-to-wizard mapping, but not
Kendo's behaviour. Do not commit the portal's scripts to bring it back (Kendo UI is commercial);
the raw copies stay in `raw/js/` for reading only.

## Official API

Cyprus Post Gateway API ("Cyprus Post Shipping Tool API – ePost"), v1.0 of 30 Sep 2026
(https://www.cypruspost.post/en/api-epost, PDF https://www.cypruspost.post/uploads/b47f668cb1.pdf).
Implemented by the ParcelHaste server gateway, not this extension; recorded here because its
codes, limits and test scenarios document rules the web wizard also follows.

- Through the government gateway CY Connect External; sandbox `https://sandbox-apis.cyconnect.cyprus.gov.cy`,
  docs in the API Hub `https://developer.cyconnect.cyprus.gov.cy/apihub/`.
- `POST /cyprus-post/shipping-tool/v1/epost/items` creates one or more items and returns a barcode
  per item; `GET /epost/items/{itemId}/label` returns the label PDF;
  `GET /epost/options?destinationCountryCode=GR&service=LTRLG&weight=0.056` lists options and prices.
- ISO alpha-2 country codes; services `LTRSM`, `LTRLG`, `LTRIR`, `PRCL`, `EMS`, `INRCN`; options
  `FRSPR`, `SNDPR`, `RGSTD`, `ADDAR`, `RCDLV` (product ids 51, 52, 56, 57, 67, the same as the web
  form). The item carries a required `CLIENT_REF_NUMBER` (our order id) and `CONTENT_PIECES` with
  `DESCRIPTION`, `NUMBER_OF_UNITS`, `UNIT_WEIGHT`, `UNIT_AMOUNT`, `COUNTRY_CODE`, `HS_TARIFF_CODE`.
- Access is per legal entity: email `Cds-support@dits.dmrid.gov.cy` the "Access Requirements" and
  "Consume API Requirements" forms (company registration number, representative ID), receive
  client credentials, pass 12 UAT scenarios with a Cyprus Post officer, then get production.

## Mapping gaps for spec 003

Where the `Shipment` model and the portal do not line up; each needs a decision in the spec.

- **Declared value:** the portal has no parcel-level value, only a unit amount per content piece,
  while the row input gives one declared value for the whole parcel (delivery included) and items
  may lack `unitPrice`. The value has to be split across pieces by some rule.
- **Currency:** unit amounts are euros only; non-EUR orders need conversion or must be refused.
- **Names and lines:** `recipient.name` must be split into first and last name (≤ 35 together);
  `line2`/`line3` have no field of their own and must go into Flat/Off. or Building.
- **Tax reference (IOSS, UK VAT):** no field named for it; the likely place is the sender's
  "Identification Reference (tax code/ VAT no/ code)". Unverified.
- **Service choice:** goods need Letter + Recorded Delivery (≤ 2 kg) or Parcel/EMS, and the choice
  depends on the destination's allowed services and the weight band. The adapter or a setting has
  to pick one.
- **HS codes:** our per-item `hsCode` (spec 006 SKU profiles) versus the portal's classifier guess.
- **Sender:** configured once, but its postcode and street must match the portal's lookup lists
  exactly.

## Open questions

- Does the web Create validate HS codes server-side like the API? Needs one real submit.
- What the logged-in wizard adds or changes (saved sender, catalogue, `isClient`), and where the
  label is reprinted from. Needs a CyLogin session.
- Barcode prefix for Recorded Delivery letters (the FAQ lists R registered, C parcel, CE premium
  parcel, E EMS, U untracked goods; the manual's example is `UB000939985CY`).
- CN22 vs CN23: no Cyprus Post threshold found; the wizard produces one declaration either way.
