// Fixtures must be synthetic. A simple heuristic: emails on reserved domains only,
// phone numbers only from drama ranges.
import path from "node:path";
import { read, walk } from "./files.ts";
import type { Violation } from "./types.ts";

export const FIXTURES_DIR = "fixtures";
const TEXT_EXTENSIONS = new Set([
  ".tsv",
  ".csv",
  ".json",
  ".md",
  ".txt",
  ".html",
  ".htm",
  ".har",
  ".xml",
  ".yaml",
  ".yml",
]);
const EMAIL = /[A-Za-z0-9._%+-]+@([A-Za-z0-9.-]+\.[A-Za-z]{2,})/g;
const RESERVED_DOMAIN = /(^|\.)(example\.(com|net|org)|[a-z0-9-]+\.(example|test|invalid))$/i;
const PHONE_LIKE = /\+?\d[\d ().-]{6,}\d/g;
/** Rejects runs that are really prices or decimals, e.g. "12.50 4.90 0.00". */
const DECIMAL = /\d\.\d/;
/** UK Ofcom drama range 07700 900000-900999 and the NANP 555-0100 to 555-0199 block. */
const RESERVED_PHONE = /7700[\s.-]?900\d{3}|555[\s.-]?01\d{2}/;

export function checkFixtures(root: string): Violation[] {
  const violations: Violation[] = [];
  for (const file of walk(root, FIXTURES_DIR)) {
    if (!TEXT_EXTENSIONS.has(path.posix.extname(file).toLowerCase())) {
      continue;
    }
    const content = read(root, file);
    for (const match of content.matchAll(EMAIL)) {
      if (!RESERVED_DOMAIN.test(match[1] ?? "")) {
        violations.push({
          rule: "fixture-email",
          file,
          message: `"${match[0]}" is not on example.com/net/org; fixtures must be synthetic`,
        });
      }
    }
    for (const match of content.matchAll(PHONE_LIKE)) {
      const digits = match[0].replace(/\D/g, "");
      if (
        digits.length < 9 ||
        digits.length > 15 ||
        DECIMAL.test(match[0]) ||
        RESERVED_PHONE.test(match[0])
      ) {
        continue;
      }
      violations.push({
        rule: "fixture-phone",
        file,
        message: `"${match[0].trim()}" looks like a real phone number; use +44 7700 900xxx or +1 ... 555 01xx`,
      });
    }
  }
  return violations;
}
