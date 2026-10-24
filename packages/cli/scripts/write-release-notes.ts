// Release tooling, not a public CLI command. The same authored copy feeds
// GitHub Highlights and the website manifest (ADR 0054).
import assert from "node:assert/strict";
import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { MANIFEST_PRODUCTS, releaseHighlights } from "../src/release-manifest.js";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..", "..");

if (process.argv[2] === "--check") {
  const root = path.resolve(process.argv[3] ?? repoRoot);
  for (const product of MANIFEST_PRODUCTS.filter((entry) => entry.public)) {
    const directory = path.join(root, product.directory);
    const { version } = JSON.parse(await readFile(path.join(directory, "package.json"), "utf8")) as { version: string };
    const copy = await readFile(path.join(directory, "CHANGELOG.md"), "utf8");
    assert.ok(releaseHighlights(copy, version), `${product.id}@${version} needs an authored product note; name this delivery in Changesets`);
  }
} else {
  const [changelog, version, output] = process.argv.slice(2);
  assert.ok(changelog && version && output, "Expected changelog path, package version and output path");
  const notes = releaseHighlights(await readFile(changelog, "utf8"), version);
  assert.ok(notes, `No authored product notes match ${version}; refusing to prepare a release`);
  await writeFile(output, notes, "utf8");
}
