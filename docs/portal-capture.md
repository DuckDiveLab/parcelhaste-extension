# Capturing a carrier portal for fixtures

Spec 003 (the Cyprus Post `dom` adapter) is written against sanitized captures of the portal,
never against the live site. This is how the maintainer produces them in Chrome. Raw captures go
under `fixtures/carriers/<id>/raw/`, which git ignores; only sanitized files are committed, and
`harness-check` scans them for anything that still looks personal.

## 1. Form inventory (no values, safe to share)

Log in to the portal, open the page that creates a shipment label, and paste this into the
DevTools console. It copies a JSON description of every form field, with labels and select
options but no values, to the clipboard.

```js
copy(JSON.stringify({
  url: location.href.replace(/\?.*$/, ""),
  title: document.title,
  headings: [...document.querySelectorAll("h1,h2,h3,legend")].map((h) => h.textContent.trim()).filter(Boolean),
  forms: [...document.querySelectorAll("form")].map((form, index) => ({
    index, id: form.id || undefined, action: form.getAttribute("action") || undefined, method: form.method,
    fields: [...form.querySelectorAll("input,select,textarea,button")].map((el) => ({
      tag: el.tagName.toLowerCase(), type: el.type, name: el.name || undefined, id: el.id || undefined,
      required: el.required || undefined, placeholder: el.placeholder || undefined,
      label: ((el.labels && el.labels[0]) || el.closest("label"))?.textContent.trim() || undefined,
      options: el.tagName === "SELECT" ? [...el.options].slice(0, 300).map((o) => ({ value: o.value, text: o.text.trim() })) : undefined,
    })),
  })),
}, null, 2))
```

Save it as `fixtures/carriers/<id>/create-label.fields.json`. Repeat on each step of a
multi-step form and on the customs (CN22/CN23) section with a non-EU destination selected.

## 2. Page HTML

On the same page run `copy(document.documentElement.outerHTML)` and save the clipboard as
`fixtures/carriers/<id>/raw/create-label.empty.html`. Do it again after filling a non-EU shipment
(`create-label.filled.html`), after a rejected submit (`create-label.errors.html`), on the
confirmation page (`confirmation.html`) and on the page shown when the session has expired
(`login-required.html`).

## 3. Submit request (HAR)

Open DevTools → Network, tick "Preserve log", create one label to your own address, then
"Export HAR" and save it as `fixtures/carriers/<id>/raw/submit.har`. Save the label PDF next to
it. A label to your own address costs one stamp and keeps customer data out of the capture.

## 4. Sanitize

```sh
node scripts/sanitize-capture.ts fixtures/carriers/cyprus-post/raw/create-label.empty.html \
  --out fixtures/carriers/cyprus-post/create-label.empty.html \
  --redact "Your Name,Your Street,Your Account Number"
node scripts/sanitize-capture.ts fixtures/carriers/cyprus-post/raw/submit.har \
  --out fixtures/carriers/cyprus-post/submit.har --redact "Your Name,Your Street"
bun run harness:check
```

The sanitizer removes scripts, cookies, authorization and token headers, blanks token-like
parameters and hidden inputs, and replaces emails, phone numbers and the strings you list with
synthetic values. `harness-check` refuses fixtures that still contain real-looking emails or
phone numbers. Read the result once yourself before committing: the tool cannot recognise a
name it was not told about.

## 5. Facts to note while you are there

Write them into `src/carriers/<id>/README.md` under "Portal facts": the exact URL patterns, which
services are offered for letter post and parcels, where the tracking number appears, whether the
customs section is part of the label form or a separate "shipping tool" step, and any rule that
limits what can be sent with which service.
