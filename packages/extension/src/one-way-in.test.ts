import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it, vi } from "vitest";

// suite-survives-a-loaded-machine:
// this file reads `package.json` from disk, so its cost varies with the
// machine. Measured 2026-09-08 at 13ms test time (3.27s wall, almost all
// of it transform and prepare). Sized well above that, since the work
// being timed is one synchronous read.
vi.setConfig({ testTimeout: 10000 });

// one-way-in-to-run task 4.7.
//
// Asserted over the manifest rather than over the code, because the
// defect this change fixes was never in the code: two entries each did
// what they said, and the confusion was that both were contributed. A
// test on behaviour would have passed throughout.

const manifest = JSON.parse(
  readFileSync(path.join(path.dirname(fileURLToPath(import.meta.url)), "..", "package.json"), "utf8"),
) as {
  contributes: {
    commands: Array<{ command: string; title: string }>;
    menus: Record<string, Array<{ command?: string; when?: string }>>;
  };
};

/** A command is an entry when the manifest contributes it — that is what
 * puts it in the palette and the menus. A command registered without
 * being contributed is callable (the chat participant's `/implement`
 * calls one) and is in no menu, so it is not a way in. */
const contributed = new Set(manifest.contributes.commands.map((entry) => entry.command));

describe("the extension contributes one way to start a run", () => {
  it("contributes exactly one command that starts work on a change", () => {
    const starters = [...contributed].filter((command) =>
      command === "openspec-ui.runWithHarness" || command === "openspec-ui.startImplementation");

    expect(starters).toEqual(["openspec-ui.runWithHarness"]);
  });

  it("contributes no menu item for the removed entry", () => {
    const inMenus = Object.values(manifest.contributes.menus)
      .flat()
      .filter((entry) => entry.command === "openspec-ui.startImplementation");

    expect(inMenus).toEqual([]);
  });

  it("names the entry Run, not one of the things it offers", () => {
    // It offers three paths. Naming it after one of them is how it came
    // to sit beside a second entry named after another.
    const run = manifest.contributes.commands.find((entry) => entry.command === "openspec-ui.runWithHarness");

    expect(run?.title).toBe("OpenSpec UI: Run");
  });

  it("puts no second menu item beside Run for what the dialog already shows", () => {
    // The findings and the recommendation are inside the dialog now. A
    // menu item beside Run offering the same answer is the duplication
    // this change exists to remove.
    const onActiveChange = (manifest.contributes.menus["view/item/context"] ?? [])
      .filter((entry) => (entry.when ?? "").includes("openspec-ui.activeChange"))
      .map((entry) => entry.command);

    expect(onActiveChange).not.toContain("openspec-ui.recommendHarnessTemplate");
    expect(onActiveChange).not.toContain("openspec-ui.explainHarnessSettings");
  });

  it("still offers them on an archived change, which has no Run", () => {
    // Narrowed, not deleted: an archived change cannot be started, so
    // there these entries are the only way to ask.
    const onArchived = (manifest.contributes.menus["view/item/context"] ?? [])
      .filter((entry) => (entry.when ?? "").includes("openspec-ui.archivedChange"))
      .map((entry) => entry.command);

    expect(onArchived).toContain("openspec-ui.recommendHarnessTemplate");
    expect(onArchived).toContain("openspec-ui.explainHarnessSettings");
  });

  it("keeps the surviving entry's id, so existing keybindings still work", () => {
    // Renaming it would have been tidier and would have silently broken
    // every keybinding someone had chosen deliberately.
    expect(contributed.has("openspec-ui.runWithHarness")).toBe(true);
  });
});
