import { mkdir, mkdtemp, readdir, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  LEFTOVER_SWEEP_INTERVAL_MS,
  changeNamesKnown,
  clearWorktreeShells,
  holdsNoFile,
  readWorktreeShells,
  whoMightHold,
  withHolders,
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

// what-is-finished-is-tidied-away 1.4 and 2.3.
describe("an empty leftover", () => {
  it("is cleared where its change is archived", async () => {
    const root = await workspaceWith({ "archive/2026-09-10-left-empty": { "proposal.md": "## Why\n" } });
    await mkdir(path.join(root, "openspec", "changes", "left-empty"), { recursive: true });

    const sweep = await clearWorkspaceLeftovers(root);

    expect(sweep.removed.map((one) => one.name)).toEqual(["left-empty"]);
    expect(await namesUnder(root, "openspec/changes")).toEqual(["archive"]);
  });

  it("is kept where nothing of its name is archived", async () => {
    const root = await workspaceWith({});
    await mkdir(path.join(root, "openspec", "changes", "my-idea"), { recursive: true });

    const sweep = await clearWorkspaceLeftovers(root);

    expect(sweep.removed).toEqual([]);
    expect(sweep.kept.map((one) => one.name)).toEqual(["my-idea"]);
  });
});

describe("the shells under the worktree root", () => {
  async function worktreeRootWith(shape: Record<string, string | null>): Promise<string> {
    const root = await mkdtemp(path.join(os.tmpdir(), "openspec-shells-"));
    roots.push(root);
    for (const [relative, contents] of Object.entries(shape)) {
      const full = path.join(root, ...relative.split("/"));
      if (contents === null) {
        await mkdir(full, { recursive: true });
      } else {
        await mkdir(path.dirname(full), { recursive: true });
        await writeFile(full, contents, "utf8");
      }
    }
    return root;
  }

  it("finds a directory git no longer lists, and says whether it holds anything", async () => {
    const root = await worktreeRootWith({
      "a-shell/packages/server": null,
      "still-working/packages/core/index.ts": "// work",
      "listed/packages": null,
      ".agent-status": null,
    });

    const shells = await readWorktreeShells(root, [path.join(root, "listed")]);

    expect(shells.map((shell) => [shell.name, shell.empty])).toEqual([["a-shell", true], ["still-working", false]]);
  });

  it("removes the empty ones and keeps what holds a file", async () => {
    const root = await worktreeRootWith({
      "a-shell/packages/server": null,
      "still-working/notes.txt": "mine",
    });

    const sweep = await clearWorktreeShells(root, []);

    expect(sweep.removed.map((one) => one.name)).toEqual(["a-shell"]);
    expect(sweep.kept.map((one) => one.name)).toEqual(["still-working"]);
    expect(await namesUnder(root, ".")).toEqual(["still-working"]);
  });

  // the-sweep-comes-back-for-what-it-left. Emptiness alone left behind
  // exactly the shell a removal actually leaves: one holding a file some
  // process had locked.
  it("counts a shell named after a change of this repository as ours, whatever is in it", async () => {
    const root = await worktreeRootWith({
      "a-change/packages/extension/.vscode-test/editor.txt": "a downloaded editor",
      "somebody-elses/notes.txt": "mine",
    });

    const shells = await readWorktreeShells(root, [], new Set(["a-change"]));

    expect(shells.map((shell) => [shell.name, shell.empty, shell.ours]))
      .toEqual([["a-change", false, true], ["somebody-elses", false, false]]);
  });

  it("removes a shell of ours that holds something, and keeps what is not ours", async () => {
    const root = await worktreeRootWith({
      "a-change/packages/extension/.vscode-test/editor.txt": "a downloaded editor",
      "somebody-elses/notes.txt": "mine",
    });

    const sweep = await clearWorktreeShells(root, [], new Set(["a-change"]));

    expect(sweep.removed.map((one) => one.name)).toEqual(["a-change"]);
    expect(sweep.kept.map((one) => one.name)).toEqual(["somebody-elses"]);
    expect(await namesUnder(root, ".")).toEqual(["somebody-elses"]);
  });

  // A checkout of its own is not a shell, whatever it is named: a worktree
  // writes `.git` as a file, a clone as a directory.
  it("leaves a directory holding a checkout of its own, by either spelling", async () => {
    const root = await worktreeRootWith({
      "a-change/.git": "gitdir: elsewhere",
      "another-change/.git/HEAD": "ref: refs/heads/main",
    });

    const shells = await readWorktreeShells(root, [], new Set(["a-change", "another-change"]));

    expect(shells.map((shell) => shell.ours)).toEqual([false, false]);
    expect((await clearWorktreeShells(root, [], new Set(["a-change", "another-change"]))).removed).toEqual([]);
  });

  // The old rule still stands on its own: an empty shell goes even where
  // nothing of that name was ever a change.
  it("still removes an empty shell nobody named after a change", async () => {
    const root = await worktreeRootWith({ "a-shell/packages": null });

    expect((await clearWorktreeShells(root, [])).removed.map((one) => one.name)).toEqual(["a-shell"]);
  });

  it("calls a directory of empty directories empty, and one with a file deep inside not", async () => {
    const root = await worktreeRootWith({
      "deep-empty/one/two/three": null,
      "deep-file/one/two/kept.txt": "x",
    });

    expect(await holdsNoFile(path.join(root, "deep-empty"))).toBe(true);
    expect(await holdsNoFile(path.join(root, "deep-file"))).toBe(false);
  });
});

describe("changeNamesKnown", () => {
  it("reads the active changes and the archived ones, without their dates", async () => {
    const root = await mkdtemp(path.join(os.tmpdir(), "openspec-names-"));
    roots.push(root);
    const changes = path.join(root, "openspec", "changes");
    await mkdir(path.join(changes, "a-change"), { recursive: true });
    await mkdir(path.join(changes, "archive", "2026-09-22-an-old-change"), { recursive: true });
    await writeFile(path.join(changes, "loose-note.md"), "x", "utf8");

    expect([...await changeNamesKnown(root)].sort()).toEqual(["a-change", "an-old-change"]);
  });

  it("knows no names in a repository that has no changes at all", async () => {
    const root = await mkdtemp(path.join(os.tmpdir(), "openspec-names-"));
    roots.push(root);

    expect([...await changeNamesKnown(root)]).toEqual([]);
  });
});

describe("whoMightHold", () => {
  it("names the processes whose command line mentions the directory", async () => {
    const directory = path.join(os.tmpdir(), "openspec-held", "changes-views");
    const listed = process.platform === "win32"
      ? ["4182|node.exe|node tsx cli.ts " + directory, "9|idle.exe|idle"].join("\n")
      : ["4182 node node tsx cli.ts " + directory, "9 idle idle"].join("\n");

    const holders = await whoMightHold(directory, { run: async () => listed });

    expect(holders.map((holder) => holder.pid)).toEqual([4182]);
    expect(holders[0]?.commandLine).toContain("cli.ts");
  });

  it("answers an empty list where the process list cannot be read", async () => {
    const holders = await whoMightHold("/anything", {
      run: async () => {
        throw new Error("no such command");
      },
    });

    expect(holders).toEqual([]);
  });
});

describe("withHolders", () => {
  it("says the original error where nothing names the directory", async () => {
    const said = await withHolders(path.join(os.tmpdir(), "openspec-unheld"), new Error("EBUSY: resource busy"));

    expect(said).toContain("EBUSY: resource busy");
    expect(said).toContain("No process names this directory");
  });
});
