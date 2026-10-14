import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdirSync, mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { test } from "node:test";
import { createZip, readZip, zipDirectory } from "./zip.ts";

test("createZip round-trips entries through readZip", () => {
  const entries = [
    { name: "manifest.json", data: Buffer.from('{"a":1}') },
    { name: "sidepanel/main.js", data: Buffer.from("console.log('x'.repeat(1000))") },
  ];
  const archive = createZip(entries);
  const back = readZip(archive);
  assert.deepEqual(
    back.map((entry) => [entry.name, entry.data.toString()]),
    entries.map((entry) => [entry.name, entry.data.toString()]),
  );
});

test("createZip is deterministic for the same input", () => {
  const entries = [{ name: "a.txt", data: Buffer.from("hello") }];
  assert.ok(createZip(entries).equals(createZip(entries)));
});

test("zipDirectory sorts files and the archive passes `unzip -t` when available", () => {
  const dir = mkdtempSync(path.join(tmpdir(), "zip-"));
  mkdirSync(path.join(dir, "b"));
  writeFileSync(path.join(dir, "b/two.txt"), "two");
  writeFileSync(path.join(dir, "one.txt"), "one");
  const outFile = path.join(tmpdir(), `zip-${process.pid}.zip`);
  assert.deepEqual(zipDirectory(dir, outFile), ["b/two.txt", "one.txt"]);
  assert.equal(readZip(readFileSync(outFile)).length, 2);

  const unzip = spawnSync("unzip", ["-t", outFile], { encoding: "utf8" });
  if (unzip.error === undefined) {
    assert.equal(unzip.status, 0, unzip.stdout + unzip.stderr);
  }
});
