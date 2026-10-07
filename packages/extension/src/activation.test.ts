import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it, vi } from "vitest";

// suite-survives-a-loaded-machine: one synchronous read of `package.json`,
// sized as one-way-in.test.ts is.
vi.setConfig({ testTimeout: 10000 });

// landed-changes-are-archived-without-waiting 1.1.
//
// With no activation event of its own the extension started only when its
// view was opened, and so did the sweep that archives what landed: on
// 2026-10-07 a window on this repository stayed open all morning with the
// view closed, and a change merged the evening before was archived three
// minutes after the view was opened, twenty hours on. Asserted over the
// manifest, since that is where the fault was.

const manifest = JSON.parse(
  readFileSync(path.join(path.dirname(fileURLToPath(import.meta.url)), "..", "package.json"), "utf8"),
) as { activationEvents?: string[] };

describe("activation", () => {
  it("starts in any workspace that holds an OpenSpec project, view open or not", () => {
    expect(manifest.activationEvents).toEqual(expect.arrayContaining([
      "workspaceContains:openspec/changes",
      "workspaceContains:openspec/config.yaml",
      "workspaceContains:openspec/project.md",
    ]));
  });
});
