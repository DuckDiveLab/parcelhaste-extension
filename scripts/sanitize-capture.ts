// Sanitizes a raw portal capture so it can be committed as a fixture.
// Usage: node scripts/sanitize-capture.ts <input.html|input.har> --out <file> [--redact "Name,Street,Account"]
// Raw captures live under fixtures/**/raw/ (git-ignored). See docs/portal-capture.md.
import { readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { sanitizeHar, sanitizeHtml } from "./lib/sanitize.ts";

function main(argv: string[]): number {
  let input: string | undefined;
  let out: string | undefined;
  let redact: string[] = [];
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === "--out") {
      out = argv[index + 1];
      index += 1;
    } else if (arg === "--redact") {
      redact = (argv[index + 1] ?? "").split(",").map((s) => s.trim());
      index += 1;
    } else if (arg !== undefined && !arg.startsWith("--")) {
      input = arg;
    }
  }
  if (input === undefined || out === undefined) {
    console.error("usage: sanitize-capture <input.html|input.har> --out <file> [--redact a,b,c]");
    return 2;
  }
  const raw = readFileSync(input, "utf8");
  const extension = path.extname(input).toLowerCase();
  let result: string;
  if (extension === ".har" || extension === ".json") {
    result = `${JSON.stringify(sanitizeHar(JSON.parse(raw), { redact }), null, 2)}\n`;
  } else {
    result = sanitizeHtml(raw, { redact });
  }
  writeFileSync(out, result);
  console.log(
    `${out}: ${result.length} characters; run \`bun run harness:check\` before committing`,
  );
  return 0;
}

process.exitCode = main(process.argv.slice(2));
