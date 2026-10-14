# Cyprus Post (ePost) adapter

Status: scaffold. Strategy: `dom` first, `http` once the portal's requests are recorded.
Spec: `docs/specs/README.md`, spec 003 (blocked on the fixtures below).

## Fixtures needed before spec 003 can be written

All fixtures go under `fixtures/carriers/cyprus-post/` and must be sanitized: no real
names, addresses, phone numbers, emails, account numbers, session cookies or tokens.
How to capture and sanitize them: `docs/portal-capture.md`.

| File | What it is | Why |
|---|---|---|
| `create-label.fields.json` | Form inventory from the console snippet in `docs/portal-capture.md` | Field names, labels and select options, no values |
| `login-required.html` | Portal page shown when the session has expired | Detect `not_logged_in` |
| `create-label.empty.html` | The label creation form, untouched | Field selectors for the `dom` strategy |
| `create-label.filled.html` | The same form after filling a non-EU shipment, before submit | Verify every field maps, incl. CN22/CN23 section |
| `create-label.errors.html` | The form after the portal rejected it (e.g. missing phone) | Map portal errors to `portal_rejected` |
| `confirmation.html` | The page after a successful submit | Where the shipment and tracking numbers appear |
| `label.pdf` | A label PDF with synthetic data | Output naming and the merged-PDF spec |
| `submit.har` | The submit request/response from DevTools, cookies and tokens removed | The later `http` strategy |
| `services.md` | Which services the portal offers (letter post vs parcel, tracked vs untracked) | `supports()` rules; CONTEXT.md terms marked `(verify)` |

Record the portal URL patterns for `info.portalMatches` at the same time.

## Portal facts (verify)

From public Cyprus Post pages, not yet verified against the logged-in portal:

- The ePost portal (`epost.cypruspost.gov.cy`) creates shipment labels, keeps a catalogue of
  created items for reprinting, and offers bulk dispatch to holders of a Postage Paid Licence.
  Login is through CyLogin. No public API or file import was found.
- A separate "Shipping Tool" (eCustoms) is mandatory for some destinations and contents; labels
  created elsewhere are not accepted for those items. Expect the customs declaration to live
  there rather than in the plain label form.
- Since 1 January 2026 goods are not accepted in outbound registered items; goods go by recorded
  delivery. This decides which service the adapter books for parcels with goods.
