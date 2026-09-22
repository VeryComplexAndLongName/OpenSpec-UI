// Live, inside the editor's own Electron (the-sweep-never-opens-an-archive).
//
// On 2026-09-22 the workspace sweep could not remove a finished working
// directory holding a downloaded editor: Electron's `fs` read its
// `node_modules.asar` as an archive, opened it, and failed on it with
// EBUSY, and the editor held the file from then on. Only here does `fs`
// behave that way, so only here can the removal be shown to be safe.

import * as assert from "node:assert/strict";
import { mkdtemp, mkdir } from "node:fs/promises";
import { createRequire } from "node:module";
import os from "node:os";
import path from "node:path";
import * as vscode from "vscode";
import { readsArchivesAsFiles, removeTree } from "@openspec-ui/core";

/** Electron's unpatched `fs`, for the fixture: the patched one would read
 * the archive the fixture copies as a directory. */
const originalFs = createRequire(path.join(process.cwd(), "removal.test.cjs"))("original-fs") as typeof import("node:fs");

suite("openspec-ui-vscode - removing a directory tree in the editor", () => {
  test("a directory holding a *.asar is removed, and nothing holds the file afterwards", async () => {
    assert.ok(process.versions.electron, "this suite runs in Electron");
    assert.equal(readsArchivesAsFiles, true, "original-fs was found");
    const archive = path.join(vscode.env.appRoot, "node_modules.asar");
    assert.ok(originalFs.existsSync(archive), `the editor ships ${archive}`);

    const root = await mkdtemp(path.join(os.tmpdir(), "openspec-asar-"));
    const inner = path.join(root, "packages", "extension", ".vscode-test", "resources", "app");
    await mkdir(inner, { recursive: true });
    originalFs.copyFileSync(archive, path.join(inner, "node_modules.asar"));
    originalFs.writeFileSync(path.join(inner, "other.txt"), "x");

    await removeTree(root);

    assert.equal(originalFs.existsSync(root), false);
  });
});
