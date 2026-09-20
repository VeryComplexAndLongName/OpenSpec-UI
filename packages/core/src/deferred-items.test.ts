import { mkdtemp, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";
import { deferItem, deferredListPath, readDeferredItems } from "./deferred-items.js";

// every-varying-check-has-a-budget: each test makes a temporary
// directory and reads and writes one small file, whose time varies with
// the disk and the machine's load. Measured on 2026-09-20: the six
// together take under 30 ms, so ten seconds is a ceiling for a bad day
// rather than an expectation.
vi.setConfig({ testTimeout: 10_000 });

// a-change-lands-with-nothing-open 3. The questions that outlive their
// changes, in the one file they move to.

const roots: string[] = [];

afterEach(async () => {
  await Promise.all(roots.splice(0).map((root) => rm(root, { recursive: true, force: true }).catch(() => undefined)));
});

async function workspace(list?: string): Promise<string> {
  const root = await mkdtemp(path.join(os.tmpdir(), "openspec-deferred-"));
  roots.push(root);
  await mkdir(path.join(root, "openspec"), { recursive: true });
  if (list !== undefined) await writeFile(deferredListPath(root), list, "utf8");
  return root;
}

describe("the deferred list", () => {
  it("has nothing where no list exists, rather than failing", async () => {
    expect(await readDeferredItems(await workspace())).toEqual([]);
  });

  it("reads each question and the change that raised it", async () => {
    const root = await workspace([
      "# Deferred",
      "",
      "- [ ] Whether a ceiling per unit reads clearly (from a-run-budget-has-a-unit)",
      "- [x] Whether the tour reads without sound (from a-tour-is-recorded)",
      "",
    ].join("\n"));

    const items = await readDeferredItems(root);

    expect(items.map((one) => one.fromChange)).toEqual(["a-run-budget-has-a-unit", "a-tour-is-recorded"]);
    expect(items.map((one) => one.done)).toEqual([false, true]);
    expect(items[0]?.text).toContain("reads clearly");
  });

  it("keeps a question that names no change", async () => {
    const root = await workspace("- [ ] Whether the icons still read at 125 per cent\n");

    const items = await readDeferredItems(root);

    expect(items).toHaveLength(1);
    expect(items[0]?.fromChange).toBeUndefined();
  });

  it("starts the file with its heading where there is none", async () => {
    const root = await workspace();

    await deferItem(root, { text: "Whether it reads clearly", fromChange: "a-run-budget-has-a-unit" });

    const written = await readFile(deferredListPath(root), "utf8");
    expect(written).toContain("# Deferred");
    expect(written).toContain("- [ ] Whether it reads clearly (from a-run-budget-has-a-unit)");
  });

  it("appends, so what somebody wrote around it survives", async () => {
    const root = await workspace([
      "# Deferred",
      "",
      "Some words the owner wrote here.",
      "",
      "- [ ] An older question (from an-older-change)",
      "",
    ].join("\n"));

    await deferItem(root, { text: "A newer question", fromChange: "a-newer-change" });

    const written = await readFile(deferredListPath(root), "utf8");
    expect(written).toContain("Some words the owner wrote here.");
    expect(written).toContain("An older question");
    expect(written.trimEnd().endsWith("- [ ] A newer question (from a-newer-change)")).toBe(true);
  });

  it("reads back what it appended", async () => {
    const root = await workspace();

    await deferItem(root, { text: "One", fromChange: "change-one" });
    await deferItem(root, { text: "Two", fromChange: "change-two" });

    const items = await readDeferredItems(root);
    expect(items.map((one) => one.fromChange)).toEqual(["change-one", "change-two"]);
  });
});
