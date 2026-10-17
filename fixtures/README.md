# Fixtures

Synthetic data only. `harness-check` fails the build when a fixture looks real.

Rules:

- Emails end in `@example.com`.
- Phone numbers come from reserved drama ranges: UK `+44 7700 900000` to `900999`,
  North America `+1 <area> 555 0100` to `0199`.
- Names, streets and order ids are obviously fake (`Test Recipient`, `1 Example Street`,
  `TEST-ORDER-0001`).
- Carrier portal HTML and HAR files are sanitized before they are added: no session
  cookies, tokens, account numbers or real customer data.

Layout:

- `rows/` rows as the order tool copies them at its "Make label" step: a header line and one
  line per shipment (spec 002).
- `shipments/` `Shipment` JSON used by the core tests and the carrier contract suite.
- `carriers/<id>/` portal fixtures per carrier (see each carrier's README).
