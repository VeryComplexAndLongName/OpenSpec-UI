import { mkdir, mkdtemp, readdir, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  LEFTOVER_SWEEP_INTERVAL_MS,
  clearWorkspaceLeftovers,
  holdsChangeDocuments,
  isClearable,
  readWorkspaceLeftovers,
  removeWorkingDirectory,
} from "./workspace-leftovers.js";

// the-workspace-clears-what-it-left-behind: measured 2026-09-18 at 190ms
// for the whole file, the slowest test 40ms. Each builds a handful of
// small files in a temporary directory, so the cost follows the
// filesystem under load rather than this repository's size - hence a
// ceiling well above the measurement rather than one derived from it.
vi.setConfig({ testTimeout: 15_000 });

const roots: string[] = [];

afterEach(async () => {
  await Promise.all(roots.splice(0).map((root) => rm(root, { recursive: true, force: true })));
});

/** A workspace whose changes hold exactly the files named. */
async function workspaceWith(changes: Record<string, Record<string, string>>): Promise<string> {
  const root = await mkdtemp(path.join(os.tmpdir(), "openspec-leftovers-"));
  roots.push(root);
  for (const [relative, files] of Object.entries(changes)) {
    const directory = path.join(root, "openspec", "changes", relative);
    await mkdir(directory, { recursive: true });
    for (const [name, contents] of Object.entries(files)) {
      await writeFile(path.join(directory, name), contents, "utf8");
    }
  }
  return root;
}

async function namesUnder(root: string, relative: string): Promise<string[]> {
  return (await readdir(path.join(root, relative))).sort();
}

describe("readWorkspaceLeftovers", () => {
  it("reports a directory with no document, with what it holds", async () => {
    const root = await workspaceWith({
      "left-behind": { "harness.json": "{}" },
      "archive/2026-09-10-left-behind": { "proposal.md": "## Why\n" },
      "real-work": { "tasks.md": "- [ ] 1.1 Something\n" },
    });

    const leftovers = await readWorkspaceLeftovers(root);

    expect(leftovers.map((one) => one.name)).toEqual(["left-behind"]);
    expect(leftovers[0]?.files).toEqual(["harness.json"]);
    expect(leftovers[0]?.onlyProductFiles).toBe(true);
    expect(leftovers[0]?.archivedAs).toBe("2026-09-10-left-behind");
    expect(isClearable(leftovers[0]!)).toBe(true);
  });

  it("does not call a directory clearable where nothing of its name is archived", async () => {
    // Somebody's start: they made the directory and have not written the
    // proposal yet. The cost of being wrong here is their work.
    const root = await workspaceWith({ "my-idea": { "harness.json": "{}" } });

    const [leftover] = await readWorkspaceLeftovers(root);

    expect(leftover?.archivedAs).toBeUndefined();
    expect(isClearable(leftover!)).toBe(false);
  });

  it("does not call a directory holding .openspec.yaml alone clearable", async () => {
    // That file is how a change declares its schema, so a change being
    // started by hand can hold it and nothing else.
    const root = await workspaceWith({
      "started-by-hand": { ".openspec.yaml": "schema: spec-driven\n" },
      "archive/2026-09-10-started-by-hand": { "proposal.md": "## Why\n" },
    });

    const [leftover] = await readWorkspaceLeftovers(root);

    expect(leftover?.onlyProductFiles).toBe(false);
    expect(isClearable(leftover!)).toBe(false);
  });

  it("takes one document as enough to make a directory a change", async () => {
    const root = await workspaceWith({ "half-written": { "proposal.md": "## Why\n", "harness.json": "{}" } });

    expect(await readWorkspaceLeftovers(root)).toEqual([]);
    expect(holdsChangeDocuments(["specs"])).toBe(true);
    expect(holdsChangeDocuments(["harness.json", "status.json"])).toBe(false);
  });
});

describe("clearWorkspaceLeftovers", () => {
  it("removes what the product left behind and keeps the rest", async () => {
    const root = await workspaceWith({
      "left-behind": { "harness.json": "{}" },
      "archive/2026-09-10-left-behind": { "proposal.md": "## Why\n" },
      "my-idea": { "harness.json": "{}" },
      "real-work": { "tasks.md": "- [ ] 1.1 Something\n" },
    });

    const sweep = await clearWorkspaceLeftovers(root);

    expect(sweep.removed.map((one) => one.name)).toEqual(["left-behind"]);
    expect(sweep.kept.map((one) => one.name)).toEqual(["my-idea"]);
    expect(sweep.failures).toEqual([]);
    expect(await namesUnder(root, "openspec/changes")).toEqual(["archive", "my-idea", "real-work"]);
  });

  it("is idempotent, so two hosts sweeping one workspace is no race", async () => {
    const root = await workspaceWith({
      "left-behind": { "status.json": "{}" },
      "archive/2026-09-10-left-behind": { "tasks.md": "- [x] 1.1 Done\n" },
    });

    expect((await clearWorkspaceLeftovers(root)).removed).toHaveLength(1);
    const again = await clearWorkspaceLeftovers(root);
    expect(again.removed).toEqual([]);
    expect(again.failures).toEqual([]);
  });
});

describe("removeWorkingDirectory", () => {
  it("refuses a directory whose tree is not clean", async () => {
    const directory = await mkdtemp(path.join(os.tmpdir(), "openspec-worktree-"));
    roots.push(directory);
    await writeFile(path.join(directory, "kept.txt"), "work in progress", "utf8");

    const result = await removeWorkingDirectory(directory, {
      git: { status: async () => ({ current: "a-branch", ahead: 0, behind: 0, staged: [], modified: ["kept.txt"], notAdded: [], deleted: [], isClean: false }) },
    });

    expect(result.ok).toBe(false);
    expect(!result.ok && result.reason).toContain("not clean");
    expect(await namesUnder(directory, ".")).toEqual(["kept.txt"]);
  });

  it("deletes a link as a link, leaving what it pointed at alone", async () => {
    // A worktree's node_modules entries are junctions into the primary
    // directory, and a recursive delete through one takes that
    // directory's packages with it.
    const holder = await mkdtemp(path.join(os.tmpdir(), "openspec-worktree-"));
    roots.push(holder);
    const target = path.join(holder, "primary", "packages", "core");
    await mkdir(target, { recursive: true });
    await writeFile(path.join(target, "index.ts"), "// the real thing\n", "utf8");
    const directory = path.join(holder, "worktree");
    await mkdir(path.join(directory, "node_modules", "@openspec-ui"), { recursive: true });
    const { symlink } = await import("node:fs/promises");
    await symlink(target, path.join(directory, "node_modules", "@openspec-ui", "core"), "junction");

    const result = await removeWorkingDirectory(directory, {
      git: { status: async () => ({ current: "a-branch", ahead: 0, behind: 0, staged: [], modified: [], notAdded: [], deleted: [], isClean: true }) },
    });

    expect(result.ok).toBe(true);
    expect(result.ok && result.linksRemoved).toBe(1);
    expect(await namesUnder(holder, ".")).toEqual(["primary"]);
    expect(await namesUnder(target, ".")).toEqual(["index.ts"]);
  });

  it("treats a directory already gone as removed", async () => {
    const holder = await mkdtemp(path.join(os.tmpdir(), "openspec-worktree-"));
    roots.push(holder);

    const result = await removeWorkingDirectory(path.join(holder, "never-there"));

    expect(result.ok).toBe(true);
  });
});

describe("LEFTOVER_SWEEP_INTERVAL_MS", () => {
  it("is one value both hosts read", () => {
    expect(LEFTOVER_SWEEP_INTERVAL_MS).toBe(30 * 60_000);
  });
});
