import assert from "node:assert/strict";
import { mkdirSync, mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { test } from "node:test";
import { checkFixtures } from "../harness/check-fixtures.ts";
import {
  REDACTED,
  REDACTED_EMAIL,
  REDACTED_PHONE,
  redactText,
  sanitizeHar,
  sanitizeHtml,
} from "./sanitize.ts";

test("redactText replaces emails, phone-like numbers and the caller's strings, keeps prices", () => {
  const text = "Jane Roe <jane.roe@gmail.com> +357 99 123456, 12.50 EUR, postcode 10115, Jane ROE";
  const result = redactText(text, { redact: ["Jane Roe"] });
  assert.equal(
    result,
    `${REDACTED} <${REDACTED_EMAIL}> ${REDACTED_PHONE}, 12.50 EUR, postcode 10115, ${REDACTED}`,
  );
});

test("sanitizeHtml removes scripts and blanks csrf meta and hidden token inputs", () => {
  const html = `<html><head><meta name="csrf-token" content="abc123"><script>window.session="s3cr3t"</script></head>
<body><form><input type="hidden" name="__RequestVerificationToken" value="tok"><input type="hidden" name="step" value="2">
<input name="email" placeholder="jane@gmail.com"><p>Logged in as jane.roe@gmail.com</p></form></body></html>`;
  const result = sanitizeHtml(html, { redact: ["Logged in as"] });
  assert.ok(!result.includes("<script"));
  assert.ok(!result.includes("s3cr3t"));
  assert.ok(result.includes(`content="${REDACTED}"`));
  assert.ok(result.includes(`name="__RequestVerificationToken" value="${REDACTED}"`));
  assert.ok(result.includes('name="step" value="2"'), "non-secret hidden inputs keep their value");
  assert.ok(!result.includes("gmail.com"));
});

test("sanitizeHar drops cookies and secret headers, blanks token params, redacts bodies", () => {
  const har = {
    log: {
      entries: [
        {
          request: {
            url: "https://portal.example/label?session=xyz&page=2",
            cookies: [{ name: "sid", value: "1" }],
            headers: [
              { name: "Cookie", value: "sid=1" },
              { name: "Authorization", value: "Bearer t" },
              { name: "Content-Type", value: "application/x-www-form-urlencoded" },
            ],
            queryString: [{ name: "session", value: "xyz" }],
            postData: {
              mimeType: "application/x-www-form-urlencoded",
              text: "name=Jane+Roe&email=jane.roe%40gmail.com&csrf=abc",
              params: [
                { name: "name", value: "Jane Roe" },
                { name: "csrf", value: "abc" },
              ],
            },
          },
          response: {
            cookies: [{ name: "sid", value: "2" }],
            headers: [{ name: "Set-Cookie", value: "sid=2" }],
            content: { text: "<p>Thanks Jane Roe, +44 20 7946 0999</p>" },
          },
        },
      ],
    },
  };
  const result = sanitizeHar(har, { redact: ["Jane Roe"] });
  const entry = result.log?.entries?.[0];
  assert.deepEqual(entry?.request?.cookies, []);
  assert.deepEqual(entry?.response?.cookies, []);
  assert.deepEqual(
    entry?.request?.headers?.map((h) => h.name),
    ["Content-Type"],
  );
  assert.deepEqual(entry?.response?.headers, []);
  assert.equal(entry?.request?.url, "https://portal.example/label?session=REDACTED&page=2");
  assert.deepEqual(entry?.request?.queryString, [{ name: "session", value: REDACTED }]);
  assert.deepEqual(entry?.request?.postData?.params, [
    { name: "name", value: REDACTED },
    { name: "csrf", value: REDACTED },
  ]);
  assert.equal(
    entry?.request?.postData?.text,
    "name=REDACTED&email=redacted%40example.com&csrf=REDACTED",
  );
  assert.equal(entry?.response?.content?.text, `<p>Thanks ${REDACTED}, ${REDACTED_PHONE}</p>`);
});

test("sanitized captures pass the fixture scan of harness-check", () => {
  const root = mkdtempSync(path.join(tmpdir(), "capture-"));
  const dir = path.join(root, "fixtures/carriers/cyprus-post");
  mkdirSync(dir, { recursive: true });
  writeFileSync(
    path.join(dir, "page.html"),
    sanitizeHtml("<p>jane.roe@gmail.com +357 99 123456</p>", {}),
  );
  writeFileSync(
    path.join(dir, "submit.har"),
    JSON.stringify(
      sanitizeHar({
        log: {
          entries: [
            {
              request: { url: "https://x.example/?a=1" },
              response: { content: { text: "+357 99 123456" } },
            },
          ],
        },
      }),
    ),
  );
  assert.deepEqual(checkFixtures(root), []);
});
