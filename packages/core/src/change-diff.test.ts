import { execFile } from "node:child_process";
import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { promisify } from "node:util";
import { afterEach, describe, expect, it, vi } from "vitest";
import { readChangeDiff } from "./change-diff.js";
import { gitIsolationArgs } from "./test-support/git-isolation.js";

// every-varying-check-has-a-budget: real git processes against temporary
// repositories, whose time varies with the machine and its load, as in
// git-refs.test.ts. Each test gets a generous ceiling.
vi.setConfig({ testTimeout: 60_000 });

const run = promisify(execFile);
const roots: string[] = [];

afterEach(async () => {
  await Promise.all(roots.splice(0).map((root) => rm(root, { recursive: true, force: true }).catch(() => undefined)));
});

async function git(cwd: string, args: string[]): Promise<void> {
  const env = {
    ...process.env,
    GIT_AUTHOR_NAME: "Fixture",
    GIT_AUTHOR_EMAIL: "fixture@example.com",
    GIT_COMMITTER_NAME: "Fixture",
    GIT_COMMITTER_EMAIL: "fixture@example.com",
  };
  await run("git", [...(await gitIsolationArgs()), ...args], { cwd, env });
}

async function workspace(): Promise<string> {
  const root = await mkdtemp(path.join(os.tmpdir(), "openspec-change-diff-"));
  roots.push(root);
  return root;
}

async function write(root: string, relative: string, text: string): Promise<void> {
  const file = path.join(root, ...relative.split("/"));
  await mkdir(path.dirname(file), { recursive: true });
  await writeFile(file, text, "utf8");
}

/** A repository with one active change, `alpha`, committed with one task. */
async function repositoryWithChange(): Promise<string> {
  const root = await workspace();
  await git(root, ["init", "-q", "-b", "main"]);
  await git(root, ["config", "core.autocrlf", "false"]);
  await write(root, "openspec/changes/alpha/tasks.md", "- [ ] 1.1 One\n");
  await write(root, "openspec/changes/alpha/proposal.md", "# Alpha\n");
  await git(root, ["add", "."]);
  await git(root, ["commit", "-q", "-m", "alpha"]);
  return root;
}

describe("readChangeDiff", () => {
  it("shows an edit to a committed file", async () => {
    const root = await repositoryWithChange();
    await write(root, "openspec/changes/alpha/tasks.md", "- [x] 1.1 One\n");

    const result = await readChangeDiff(root, "alpha");

    expect(result.kind).toBe("diff");
    if (result.kind !== "diff") return;
    expect(result.diff).toContain("-- [ ] 1.1 One");
    expect(result.diff).toContain("+- [x] 1.1 One");
    expect(result.files).toEqual(["openspec/changes/alpha/tasks.md"]);
    expect(result.truncated).toBe(false);
  });

  it("shows a staged edit, which a plain git diff would not", async () => {
    const root = await repositoryWithChange();
    await write(root, "openspec/changes/alpha/proposal.md", "# Alpha, staged\n");
    await git(root, ["add", "openspec/changes/alpha/proposal.md"]);

    const result = await readChangeDiff(root, "alpha");

    expect(result.kind === "diff" && result.diff).toContain("+# Alpha, staged");
  });

  it("shows an untracked new file as an added file", async () => {
    const root = await repositoryWithChange();
    await write(root, "openspec/changes/alpha/design.md", "# Design\n\nWhy.\n");

    const result = await readChangeDiff(root, "alpha");

    expect(result.kind).toBe("diff");
    if (result.kind !== "diff") return;
    expect(result.diff).toContain("new file mode 100644");
    expect(result.diff).toContain("+++ b/openspec/changes/alpha/design.md");
    expect(result.diff).toContain("@@ -0,0 +1,3 @@\n+# Design\n+\n+Why.\n");
    expect(result.files).toEqual(["openspec/changes/alpha/design.md"]);
  });

  it("answers an empty diff for a change with nothing uncommitted", async () => {
    const root = await repositoryWithChange();

    expect(await readChangeDiff(root, "alpha")).toEqual({
      kind: "diff",
      diff: "",
      files: [],
      truncated: false,
      maxBytes: 200_000,
    });
  });

  it("refuses a name that is not an active change", async () => {
    const root = await repositoryWithChange();
    await write(root, "openspec/changes/archive/2026-09-01-old/tasks.md", "- [x] 1.1 Done\n");

    for (const name of ["missing", "2026-09-01-old", "../alpha"]) {
      const result = await readChangeDiff(root, name);
      expect(result.kind).toBe("not-active");
    }
  });

  it("says a workspace is not a repository rather than answering an empty diff", async () => {
    const root = await workspace();
    await write(root, "openspec/changes/alpha/tasks.md", "- [ ] 1.1 One\n");

    const result = await readChangeDiff(root, "alpha");

    expect(result).toEqual({
      kind: "not-a-repository",
      message: "This workspace is not a git repository, so there is no diff to show.",
    });
  });

  it("cuts a diff larger than maxBytes back to its last whole line", async () => {
    const root = await repositoryWithChange();
    await write(root, "openspec/changes/alpha/notes.md", `${"a line of notes\n".repeat(40)}`);

    const result = await readChangeDiff(root, "alpha", { maxBytes: 300 });

    expect(result.kind).toBe("diff");
    if (result.kind !== "diff") return;
    expect(result.truncated).toBe(true);
    expect(Buffer.byteLength(result.diff, "utf8")).toBeLessThanOrEqual(300);
    expect(result.diff.endsWith("\n")).toBe(true);
    expect(result.files).toEqual(["openspec/changes/alpha/notes.md"]);
  });
});
