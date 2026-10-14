// Builds the Chrome extension with esbuild (ADR-0002).
// Usage: node scripts/build.ts [--watch] [--zip] [--out dist]
import { cpSync, mkdirSync, readFileSync, rmSync, watch, writeFileSync } from "node:fs";
import path from "node:path";
import { type BuildOptions, build, context } from "esbuild";
import { buildManifest } from "./lib/manifest.ts";
import { zipDirectory } from "./lib/zip.ts";

const repoRoot = path.resolve(import.meta.dirname, "..");

interface Args {
  watch: boolean;
  zip: boolean;
  out: string;
}

function parseArgs(argv: string[]): Args {
  const args: Args = { watch: false, zip: false, out: "dist" };
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === "--watch") {
      args.watch = true;
    } else if (arg === "--zip") {
      args.zip = true;
    } else if (arg === "--out") {
      args.out = argv[index + 1] ?? args.out;
      index += 1;
    } else {
      throw new Error(`unknown argument ${arg}`);
    }
  }
  return args;
}

function copyStatic(outDir: string): void {
  cpSync(path.join(repoRoot, "entrypoints/icons"), path.join(outDir, "icons"), { recursive: true });
  for (const file of ["index.html", "style.css"]) {
    cpSync(
      path.join(repoRoot, "entrypoints/sidepanel", file),
      path.join(outDir, "sidepanel", file),
    );
  }
}

async function buildExtension(args: Args, version: string): Promise<void> {
  const outDir = path.join(repoRoot, args.out, "chrome-mv3");
  rmSync(outDir, { recursive: true, force: true });
  mkdirSync(path.join(outDir, "sidepanel"), { recursive: true });
  copyStatic(outDir);
  writeFileSync(
    path.join(outDir, "manifest.json"),
    `${JSON.stringify(buildManifest(version), null, 2)}\n`,
  );

  const options: BuildOptions = {
    absWorkingDir: repoRoot,
    entryPoints: {
      background: "entrypoints/background.ts",
      "sidepanel/main": "entrypoints/sidepanel/main.ts",
    },
    outdir: outDir,
    bundle: true,
    format: "iife",
    target: ["chrome116"],
    sourcemap: args.watch ? "inline" : false,
    legalComments: "none",
    logLevel: "info",
  };

  if (args.watch) {
    const ctx = await context(options);
    await ctx.watch();
    watch(path.join(repoRoot, "entrypoints"), { recursive: true }, () => copyStatic(outDir));
    console.log(`watching: load ${path.relative(repoRoot, outDir)} as an unpacked extension`);
    return;
  }

  await build(options);
  if (args.zip) {
    const zipFile = path.join(repoRoot, args.out, `parcelhaste-${version}-chrome.zip`);
    const files = zipDirectory(outDir, zipFile);
    console.log(`${path.relative(repoRoot, zipFile)}: ${files.length} files`);
  }
}

const { version } = JSON.parse(readFileSync(path.join(repoRoot, "package.json"), "utf8")) as {
  version: string;
};
await buildExtension(parseArgs(process.argv.slice(2)), version);
