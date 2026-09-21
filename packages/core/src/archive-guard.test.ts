import { mkdir, mkdtemp, readdir, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";
import { archiveChange } from "./openspec.js";

// a-change-is-archived-with-nothing-open 2.2. The refusal comes before
// the `openspec` CLI is called, so these need no binary - which is also
// what the job that runs them has.
//
// every-varying-check-has-a-budget: a temporary workspace of small files.
// Measured on 2026-09-21: the three together take under 50 ms.
vi.setConfig({ testTimeout: 10_000 });

const roots: string[] = [];

afterEach(async () => {
  await Promise.all(roots.splice(0).map((root) => rm(root, { recursive: true, force: true }).catch(() => undefined)));
});

async function workspace(tasks: string): Promise<string> {
  const root = await mkdtemp(path.join(os.tmpdir(), "openspec-archive-guard-"));
  roots.push(root);
  const directory = path.join(root, "openspec", "changes", "the-change");
  await mkdir(directory, { recursive: true });
  await writeFile(path.join(directory, "proposal.md"), "## Why\n\nBecause.\n", "utf8");
  await writeFile(path.join(directory, "tasks.md"), tasks, "utf8");
  return root;
}

const stillThere = async (root: string) =>
  (await readdir(path.join(root, "openspec", "changes"))).includes("the-change");

describe("archiving a change that still owes something", () => {
  it("refuses an open item, names it, and moves nothing", async () => {
    const root = await workspace("- [x] 1.1 Done.\n- [ ] 1.2 Not done.\n");

    await expect(archiveChange("the-change", { cwd: root })).rejects.toThrow(/still open: 1\.2 Not done\./);
    expect(await stillThere(root)).toBe(true);
  });

  it("refuses a human-only item closed with nothing written under it", async () => {
    const root = await workspace("- [x] 1.1 **Human-only.** Whether it reads.\n");

    await expect(archiveChange("the-change", { cwd: root })).rejects.toThrow(/closed with nothing written under it/);
    expect(await stillThere(root)).toBe(true);
  });

  it("gets past the guard where nothing is owed", async () => {
    const root = await workspace("- [x] 1.1 **Human-only.** Whether it reads.\n  Looked on 2026-09-21: it reads.\n");

    // Past the guard the CLI is called, and this job has no binary for
    // it. What matters is that the refusal was not the guard's.
    await expect(archiveChange("the-change", { cwd: root, binary: "openspec-binary-that-is-not-there" }))
      .rejects.not.toThrow(/still owes/);
  });
});
