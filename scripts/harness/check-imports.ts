// Dependency boundaries from AGENTS.md, enforced on import specifiers:
//   src/core        -> only itself and runtime dependencies; no browser or Node APIs
//   src/carriers/X  -> only itself, src/core and src/carriers/_contract (never another carrier)
//   src/inputs|outputs -> only themselves and src/core
//   entrypoints     -> may import src; nothing imports entrypoints
//   src, scripts, entrypoints -> never bun or bun:* (tests included)
import path from "node:path";
import { isTestFile, read, walk } from "./files.ts";
import type { Violation } from "./types.ts";

const SCANNED_DIRS = ["src", "scripts", "entrypoints"];
const IMPORT_PATTERNS = [
  /\b(?:import|export)\b[^'"]*?\bfrom\s*["']([^"']+)["']/g,
  /\bimport\s*["']([^"']+)["']/g,
  /\bimport\(\s*["']([^"']+)["']\s*\)/g,
  /\brequire\(\s*["']([^"']+)["']\s*\)/g,
];
const NODE_BUILTINS = new Set([
  "assert",
  "buffer",
  "child_process",
  "crypto",
  "events",
  "fs",
  "http",
  "https",
  "net",
  "os",
  "path",
  "process",
  "readline",
  "stream",
  "url",
  "util",
  "worker_threads",
  "zlib",
]);
const BROWSER_GLOBALS =
  /\b(chrome|browser|window|document|navigator|localStorage|sessionStorage)\./;

type Zone =
  | { kind: "core" }
  | { kind: "contract" }
  | { kind: "carrier"; id: string }
  | { kind: "carriers-registry" }
  | { kind: "inputs" }
  | { kind: "outputs" }
  | { kind: "src" }
  | { kind: "entrypoints" }
  | { kind: "scripts" };

export function zoneOf(file: string): Zone | undefined {
  const carrier = /^src\/carriers\/([^/]+)\//.exec(file)?.[1];
  if (carrier === "_contract") {
    return { kind: "contract" };
  }
  if (carrier !== undefined) {
    return { kind: "carrier", id: carrier };
  }
  if (/^src\/carriers\/[^/]+$/.test(file)) {
    return { kind: "carriers-registry" };
  }
  if (file.startsWith("src/core/")) {
    return { kind: "core" };
  }
  if (file.startsWith("src/inputs/")) {
    return { kind: "inputs" };
  }
  if (file.startsWith("src/outputs/")) {
    return { kind: "outputs" };
  }
  if (file.startsWith("src/")) {
    return { kind: "src" };
  }
  if (file.startsWith("entrypoints/")) {
    return { kind: "entrypoints" };
  }
  if (file.startsWith("scripts/")) {
    return { kind: "scripts" };
  }
  return undefined;
}

export function importSpecifiers(content: string): string[] {
  const specifiers: string[] = [];
  for (const pattern of IMPORT_PATTERNS) {
    for (const match of content.matchAll(pattern)) {
      if (match[1] !== undefined) {
        specifiers.push(match[1]);
      }
    }
  }
  return specifiers;
}

function packageName(specifier: string): string {
  const parts = specifier.split("/");
  return specifier.startsWith("@") ? parts.slice(0, 2).join("/") : (parts[0] ?? specifier);
}

/** Directories (repo-relative, trailing slash) a zone may import from, besides itself. */
function allowedDirs(zone: Zone, file: string): string[] | undefined {
  switch (zone.kind) {
    case "core":
      return ["src/core/"];
    case "contract":
      return ["src/core/", "src/carriers/_contract/"];
    case "carrier":
      return ["src/core/", "src/carriers/_contract/", `src/carriers/${zone.id}/`];
    case "inputs":
      return ["src/core/", "src/inputs/"];
    case "outputs":
      return ["src/core/", "src/outputs/"];
    case "carriers-registry":
    case "src":
    case "entrypoints":
      return undefined;
    case "scripts":
      return undefined;
    default:
      return [path.posix.dirname(file)];
  }
}

/** Files that contain import statements as test data rather than real imports. */
const SELF = /^scripts\/harness\/check-imports\.test\.ts$/;

export function checkImports(root: string): Violation[] {
  const violations: Violation[] = [];
  const pkg = JSON.parse(read(root, "package.json")) as { dependencies?: Record<string, string> };
  const runtimeDependencies = new Set(Object.keys(pkg.dependencies ?? {}));

  for (const dir of SCANNED_DIRS) {
    for (const file of walk(root, dir)) {
      if (!/\.(ts|tsx|js|mjs|cjs)$/.test(file) || SELF.test(file)) {
        continue;
      }
      const zone = zoneOf(file);
      if (zone === undefined) {
        continue;
      }
      const content = read(root, file);
      const test = isTestFile(file);
      const browserCode = !test && zone.kind !== "scripts";

      if (zone.kind === "core" && !test && BROWSER_GLOBALS.test(content)) {
        violations.push({
          rule: "core-browser-api",
          file,
          message: "src/core must not touch browser globals (chrome, window, document, ...)",
        });
      }
      if (/\bBun\./.test(content)) {
        violations.push({
          rule: "bun-api",
          file,
          message: "Bun globals are not available in the browser or under Node",
        });
      }

      for (const specifier of importSpecifiers(content)) {
        if (specifier === "bun" || specifier.startsWith("bun:")) {
          violations.push({
            rule: "bun-api",
            file,
            message: `imports "${specifier}"; Bun-only modules are banned`,
          });
          continue;
        }
        const relative = specifier.startsWith(".");
        if (!relative) {
          const name = packageName(specifier.replace(/^node:/, ""));
          const isNode = specifier.startsWith("node:") || NODE_BUILTINS.has(name);
          if (browserCode && isNode) {
            violations.push({
              rule: "browser-node-import",
              file,
              message: `imports "${specifier}"; Node modules do not exist in the browser`,
            });
          } else if (browserCode && !runtimeDependencies.has(name)) {
            violations.push({
              rule: "undeclared-runtime-dependency",
              file,
              message: `imports "${specifier}", which is not in package.json dependencies`,
            });
          }
          continue;
        }

        const target = path.posix.normalize(path.posix.join(path.posix.dirname(file), specifier));
        if (target.startsWith("entrypoints/") && zone.kind !== "entrypoints") {
          violations.push({
            rule: "entrypoints-imported",
            file,
            message: `imports ${target}; entrypoints are glue and nothing depends on them`,
          });
          continue;
        }
        if (test) {
          continue;
        }
        const allowed = allowedDirs(zone, file);
        if (allowed !== undefined && !allowed.some((prefix) => target.startsWith(prefix))) {
          violations.push({
            rule: zone.kind === "carrier" ? "carrier-boundary" : `${zone.kind}-boundary`,
            file,
            message: `imports ${target}; ${zone.kind} may only import from ${allowed.join(", ")}`,
          });
        }
      }
    }
  }
  return violations;
}
