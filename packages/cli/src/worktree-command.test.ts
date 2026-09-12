import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { GitWorktree, GitWrapper } from "@openspec-ui/core";
import { worktreeCommand } from "./worktree-command.js";

// every-varying-check-has-a-budget: no git process is spawned — the
// wrapper is injected — so each test is a few small file writes.
// Measured 2026-09-11 under 50ms for the slowest.
vi.setConfig({ testTimeout: 15_000 });

/** No environment variable and a home with no settings file, so a test
 * reads the default rather than whatever the person running it has set. */
const NO_SETTINGS = { env: {}, homeDirectory: path.join(os.tmpdir(), "openspec-ui-no-settings-here") };

const temporaryRoots: string[] = [];

async function temporaryRoot(): Promise<string> {
  const root = await mkdtemp(path.join(os.tmpdir(), "openspec-cli-worktree-"));
  temporaryRoots.push(root);
  return root;
}

afterEach(async () => {
  await Promise.all(temporaryRoots.splice(0).map((root) => rm(root, { recursive: true, force: true })));
});

function collectingIo() {
  const out: string[] = [];
  const err: string[] = [];
  return { out, err, stdout: (line: string) => out.push(line), stderr: (line: string) => err.push(line) };
}

function fakeGit(options: {
  worktrees?: GitWorktree[];
  inRef?: boolean;
  clean?: boolean;
} = {}) {
  const added: Array<{ path: string; branch: string; base: string }> = [];
  const removed: string[] = [];
  const moved: Array<{ from: string; to: string }> = [];
  const git = {
    added,
    removed,
    moved,
    status: async () => ({ isClean: options.clean ?? true }),
    worktreeList: async () => options.worktrees ?? [{ path: "/repo", branch: "main" }],
    worktreeAdd: async (plan: { path: string; branch: string; base: string }) => {
      added.push(plan);
    },
    worktreeMove: async (from: string, to: string) => {
      moved.push({ from, to });
    },
    worktreeRemove: async (target: string) => {
      removed.push(target);
    },
    pathExistsInRef: async () => options.inRef ?? true,
  } as unknown as GitWrapper & {
    added: typeof added;
    removed: typeof removed;
    moved: typeof moved;
  };
  return git;
}

async function withActiveChange(root: string, changeName: string): Promise<void> {
  const changeDir = path.join(root, "openspec", "changes", changeName);
  await mkdir(changeDir, { recursive: true });
  await writeFile(path.join(changeDir, "proposal.md"), "# A change\n\n## Why\n\nBecause.\n", "utf8");
  await writeFile(path.join(changeDir, "tasks.md"), "- [ ] 1.1 Do it\n", "utf8");
}

describe("worktree add", () => {
  it("creates the directory and reports the command that runs the chain there", async () => {
    const root = await temporaryRoot();
    const io = collectingIo();
    const git = fakeGit();

    const code = await worktreeCommand(
      { repositoryRoot: root, action: "add", changeName: "a-change", format: "text" },
      { ...io, createGit: () => git },
    );

    expect(code).toBe(0);
    expect(git.added).toHaveLength(1);
    expect(git.added[0]).toMatchObject({ branch: "a-change", base: "main" });
    // The path is long and starting the chain is the next thing to
    // happen, so the command is printed rather than described.
    expect(io.out.join("\n")).toContain("openspec-ui-cli run a-change --cwd");
  });

  it("refuses a change that is not in the base, and creates nothing", async () => {
    const root = await temporaryRoot();
    const io = collectingIo();
    const git = fakeGit({ inRef: false });

    const code = await worktreeCommand(
      { repositoryRoot: root, action: "add", changeName: "a-change", format: "text" },
      { ...io, createGit: () => git },
    );

    expect(code).toBe(1);
    expect(git.added).toHaveLength(0);
    expect(io.err.join("\n")).toContain("commit openspec/changes/a-change");
  });

  it("cuts from the base it was given", async () => {
    const root = await temporaryRoot();
    const io = collectingIo();
    const git = fakeGit();

    await worktreeCommand(
      { repositoryRoot: root, action: "add", changeName: "a-change", base: "release/1.x", format: "text" },
      { ...io, createGit: () => git },
    );

    expect(git.added[0]).toMatchObject({ base: "release/1.x" });
  });
});

describe("worktree list", () => {
  it("marks a directory whose change is no longer active", async () => {
    const root = await temporaryRoot();
    await withActiveChange(root, "still-going");
    const io = collectingIo();
    const git = fakeGit({
      worktrees: [
        { path: root, branch: "main" },
        { path: path.join(root, "w", "still-going"), branch: "still-going" },
        { path: path.join(root, "w", "long-archived"), branch: "long-archived" },
      ],
    });

    const code = await worktreeCommand(
      { repositoryRoot: root, action: "list", format: "text" },
      { ...io, createGit: () => git },
    );

    expect(code).toBe(0);
    const printed = io.out.join("\n");
    expect(printed).toContain("(main)");
    // A directory outliving the change it was made for is the litter
    // this listing exists to surface.
    expect(printed).toContain("long-archived");
    expect(printed).toContain("its change is no longer active");
    expect(printed.split("\n").find((line) => line.includes("still-going")))
      .not.toContain("no longer active");
  });
});

describe("worktree remove", () => {
  it("refuses a directory that still holds uncommitted work", async () => {
    const root = await temporaryRoot();
    await withActiveChange(root, "a-change");
    const io = collectingIo();
    const git = fakeGit({
      clean: false,
      worktrees: [{ path: root, branch: "main" }, { path: path.join(root, "w"), branch: "a-change" }],
    });

    const code = await worktreeCommand(
      { repositoryRoot: root, action: "remove", changeName: "a-change", format: "text" },
      { ...io, createGit: () => git },
    );

    expect(code).toBe(1);
    expect(git.removed).toHaveLength(0);
    // No force flag of this tool's own: git's own says plainly what it
    // does, and the work is the whole point of the branch.
    expect(io.err.join("\n")).toContain("git worktree remove --force");
  });

  it("removes a clean directory", async () => {
    const root = await temporaryRoot();
    await withActiveChange(root, "a-change");
    const io = collectingIo();
    const git = fakeGit({
      clean: true,
      worktrees: [{ path: root, branch: "main" }, { path: path.join(root, "w"), branch: "a-change" }],
    });

    const code = await worktreeCommand(
      { repositoryRoot: root, action: "remove", changeName: "a-change", format: "text" },
      { ...io, createGit: () => git },
    );

    expect(code).toBe(0);
    expect(git.removed).toEqual([path.join(root, "w")]);
  });

  it("says so when there is no directory for that change", async () => {
    const root = await temporaryRoot();
    const io = collectingIo();
    const git = fakeGit();

    const code = await worktreeCommand(
      { repositoryRoot: root, action: "remove", changeName: "a-change", format: "text" },
      { ...io, createGit: () => git },
    );

    expect(code).toBe(1);
    expect(io.err.join("\n")).toContain("no working directory");
  });
});

describe("worktree move", () => {
  it("moves a directory that is not under the root, on request", async () => {
    const root = await temporaryRoot();
    await withActiveChange(root, "a-change");
    const stray = path.join(path.dirname(root), `${path.basename(root)}.worktrees`, "a-change");
    const git = fakeGit({
      worktrees: [{ path: root, branch: "main" }, { path: stray, branch: "a-change" }],
    });

    const code = await worktreeCommand(
      { repositoryRoot: root, action: "move", changeName: "a-change", format: "text" },
      { ...collectingIo(), createGit: () => git, rootSources: NO_SETTINGS },
    );

    expect(code).toBe(0);
    expect(git.moved).toHaveLength(1);
    expect(git.moved[0]?.from).toBe(stray);
    // Under the one root, named by its repository.
    expect(git.moved[0]?.to).toContain(path.join(".worktrees", path.basename(root), "a-change"));
  });

  it("moves nothing that is already under the root", async () => {
    const root = await temporaryRoot();
    await withActiveChange(root, "a-change");
    const proper = path.join(path.dirname(root), ".worktrees", path.basename(root), "a-change");
    const git = fakeGit({
      worktrees: [{ path: root, branch: "main" }, { path: proper, branch: "a-change" }],
    });
    const out = collectingIo();

    const code = await worktreeCommand(
      { repositoryRoot: root, action: "move", changeName: "a-change", format: "text" },
      { ...out, createGit: () => git },
    );

    expect(code).toBe(0);
    expect(git.moved).toEqual([]);
    expect(out.out.join("\n")).toContain("already under the root");
  });

  it("reports a stray directory in the listing but never moves it there", async () => {
    const root = await temporaryRoot();
    await withActiveChange(root, "a-change");
    const stray = path.join(path.dirname(root), "somewhere-else", "a-change");
    const git = fakeGit({
      worktrees: [{ path: root, branch: "main" }, { path: stray, branch: "a-change" }],
    });
    const out = collectingIo();

    const code = await worktreeCommand(
      { repositoryRoot: root, action: "list", format: "text" },
      { ...out, createGit: () => git },
    );

    expect(code).toBe(0);
    // Somebody may have scripts pointing at the path it has, so listing
    // says where it would go and moves nothing (ADR 0027).
    expect(out.out.join("\n")).toContain("not under the root");
    expect(git.moved).toEqual([]);
  });
});

describe("worktree remove — what leaves before the directory does", () => {
  it("takes the run history into the repository before removing", async () => {
    const root = await temporaryRoot();
    await withActiveChange(root, "a-change");
    const worktree = path.join(root, "w");
    await mkdir(path.join(worktree, ".openspec-ui"), { recursive: true });
    await writeFile(
      path.join(worktree, ".openspec-ui", "audit.jsonl"),
      JSON.stringify({ runId: "there-1", cwd: worktree }) + "\n",
      "utf8",
    );
    const out = collectingIo();
    const git = fakeGit({ worktrees: [{ path: root, branch: "main" }, { path: worktree, branch: "a-change" }] });

    const code = await worktreeCommand(
      { repositoryRoot: root, action: "remove", changeName: "a-change", format: "text" },
      { ...out, createGit: () => git, rootSources: NO_SETTINGS },
    );

    expect(code).toBe(0);
    expect(git.removed).toEqual([worktree]);
    // The directory's .openspec-ui is gitignored and removal does not see
    // ignored files, so without this the history goes with it (ADR 0027).
    const kept = await readFile(path.join(root, ".openspec-ui", "audit.jsonl"), "utf8");
    expect(kept).toContain("there-1");
    expect(out.out.join("\n")).toContain("1 run record");
  });

  it("names what it is about to discard, before discarding it", async () => {
    const root = await temporaryRoot();
    await withActiveChange(root, "a-change");
    const worktree = path.join(root, "w");
    await mkdir(path.join(worktree, ".openspec-ui", "checkpoints", "one"), { recursive: true });
    const out = collectingIo();
    const git = fakeGit({ worktrees: [{ path: root, branch: "main" }, { path: worktree, branch: "a-change" }] });

    await worktreeCommand(
      { repositoryRoot: root, action: "remove", changeName: "a-change", format: "text" },
      { ...out, createGit: () => git, rootSources: NO_SETTINGS },
    );

    const printed = out.out.join("\n");
    // A destroyed thing that was announced is a decision; one that was
    // not is a discovery, made later, by whoever needed it.
    expect(printed).toContain("Discarding 1 checkpoint");
    expect(printed.indexOf("Discarding")).toBeLessThan(printed.indexOf("Removed"));
  });
});
