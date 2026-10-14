// Spec frontmatter and the acceptance-criterion <-> test link.
import path from "node:path";
import { isTestFile, read, walk } from "./files.ts";
import type { Violation } from "./types.ts";

export const SPECS_DIR = "docs/specs";
export const SPEC_STATUSES = ["draft", "approved", "implemented", "superseded"] as const;
const SPEC_FILE = /^docs\/specs\/(\d{3})-[a-z0-9-]+\.md$/;
const AC_ID = /\bAC-(\d{3})-(\d+)\b/g;
const TEST_DIRS = ["src", "scripts", "entrypoints", "tests"];
/** The spec checker's own test builds AC ids as data. */
const SELF = /^scripts\/harness\/check-specs\.test\.ts$/;

export interface SpecInfo {
  file: string;
  id: string;
  status: string;
  acceptanceCriteria: string[];
}

export function parseFrontmatter(content: string): Record<string, string> | undefined {
  const match = /^---\r?\n([\s\S]*?)\r?\n---/.exec(content);
  if (match?.[1] === undefined) {
    return undefined;
  }
  const fields: Record<string, string> = {};
  for (const line of match[1].split(/\r?\n/)) {
    const pair = /^([A-Za-z_][\w-]*):\s*(.*)$/.exec(line);
    if (pair?.[1] !== undefined) {
      fields[pair[1]] = (pair[2] ?? "").trim().replace(/^["']|["']$/g, "");
    }
  }
  return fields;
}

export function listSpecs(root: string): { specs: SpecInfo[]; violations: Violation[] } {
  const specs: SpecInfo[] = [];
  const violations: Violation[] = [];
  for (const file of walk(root, SPECS_DIR)) {
    if (path.posix.basename(file) === "README.md") {
      continue;
    }
    const match = SPEC_FILE.exec(file);
    if (match?.[1] === undefined) {
      violations.push({ rule: "spec-filename", file, message: "must be NNN-slug.md" });
      continue;
    }
    const content = read(root, file);
    const fields = parseFrontmatter(content);
    if (fields === undefined) {
      violations.push({ rule: "spec-frontmatter", file, message: "missing frontmatter" });
      continue;
    }
    const problems: string[] = [];
    if (fields["id"] !== match[1]) {
      problems.push(`id must be "${match[1]}" (from the filename), got "${fields["id"] ?? ""}"`);
    }
    if ((fields["title"] ?? "") === "") {
      problems.push("title is required");
    }
    const status = fields["status"] ?? "";
    if (!(SPEC_STATUSES as readonly string[]).includes(status)) {
      problems.push(`status must be one of ${SPEC_STATUSES.join("|")}, got "${status}"`);
    }
    if (fields["carrier"] !== undefined && !/^[a-z0-9-]+$/.test(fields["carrier"])) {
      problems.push("carrier must be a lowercase slug");
    }
    for (const problem of problems) {
      violations.push({ rule: "spec-frontmatter", file, message: problem });
    }

    const acceptanceCriteria = new Set<string>();
    for (const ac of content.matchAll(AC_ID)) {
      if (ac[1] !== match[1]) {
        violations.push({
          rule: "spec-ac-id",
          file,
          message: `${ac[0]} belongs to spec ${ac[1]}, not ${match[1]}`,
        });
      }
      acceptanceCriteria.add(ac[0]);
    }
    specs.push({ file, id: match[1], status, acceptanceCriteria: [...acceptanceCriteria] });
  }
  return { specs, violations };
}

export function listTestReferences(root: string): Map<string, string[]> {
  const references = new Map<string, string[]>();
  for (const dir of TEST_DIRS) {
    for (const file of walk(root, dir)) {
      if (!isTestFile(file) || SELF.test(file)) {
        continue;
      }
      for (const ac of read(root, file).matchAll(AC_ID)) {
        const files = references.get(ac[0]) ?? [];
        files.push(file);
        references.set(ac[0], files);
      }
    }
  }
  return references;
}

export function checkSpecs(root: string): Violation[] {
  const { specs, violations } = listSpecs(root);
  const references = listTestReferences(root);
  const known = new Set(specs.flatMap((spec) => spec.acceptanceCriteria));

  for (const spec of specs) {
    if (spec.status !== "approved" && spec.status !== "implemented") {
      continue;
    }
    for (const ac of spec.acceptanceCriteria) {
      if (!references.has(ac)) {
        violations.push({
          rule: "spec-ac-untested",
          file: spec.file,
          message: `${ac} has no test whose file mentions it (spec is ${spec.status})`,
        });
      }
    }
  }
  for (const [ac, files] of references) {
    if (!known.has(ac)) {
      for (const file of files) {
        violations.push({ rule: "test-ac-unknown", file, message: `${ac} is not in any spec` });
      }
    }
  }
  return violations;
}
