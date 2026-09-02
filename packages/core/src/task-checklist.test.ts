import { mkdir, mkdtemp, readFile, rm, stat, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import {
  InvalidMechanicalCheckParameterError,
  TaskListChangedError,
  UnknownMechanicalCheckError,
  deleteTaskLine,
  getArchivedChangeSummary,
  readTaskChecklist,
} from "./task-checklist.js";

const temporaryRoots: string[] = [];

async function temporaryRoot(): Promise<string> {
  const root = await mkdtemp(path.join(os.tmpdir(), "openspec-task-checklist-"));
  temporaryRoots.push(root);
  return root;
}

afterEach(async () => {
  await Promise.all(temporaryRoots.splice(0).map((root) => rm(root, { recursive: true, force: true })));
});

describe("readTaskChecklist", () => {
  it("returns each checklist item with its line number and done state", async () => {
    const root = await temporaryRoot();
    const changeDir = path.join(root, "openspec", "changes", "active-change");
    await mkdir(changeDir, { recursive: true });
    await writeFile(
      path.join(changeDir, "tasks.md"),
      "## 1. Setup\n\n- [x] 1.1 First task\n- [ ] 1.2 Second task\n",
    );

    const items = await readTaskChecklist(root, "active-change", false);

    expect(items).toEqual([
      { lineNumber: 2, text: "1.1 First task", done: true },
      { lineNumber: 3, text: "1.2 Second task", done: false },
    ]);
  });

  it("reads archived changes from openspec/changes/archive/<name>/", async () => {
    const root = await temporaryRoot();
    const changeDir = path.join(root, "openspec", "changes", "archive", "old-change");
    await mkdir(changeDir, { recursive: true });
    await writeFile(path.join(changeDir, "tasks.md"), "- [ ] Only task\n");

    const items = await readTaskChecklist(root, "old-change", true);

    expect(items).toEqual([{ lineNumber: 0, text: "Only task", done: false }]);
  });

  it("returns an empty list when the change has no tasks.md", async () => {
    const root = await temporaryRoot();
    const changeDir = path.join(root, "openspec", "changes", "active-change");
    await mkdir(changeDir, { recursive: true });
    await writeFile(path.join(changeDir, "proposal.md"), "# Proposal\n");

    expect(await readTaskChecklist(root, "active-change", false)).toEqual([]);
  });

  it("returns an empty list for an unknown change name", async () => {
    const root = await temporaryRoot();
    expect(await readTaskChecklist(root, "does-not-exist", false)).toEqual([]);
  });
});

describe("readTaskChecklist — mechanical check declarations", () => {
  it("parses a task without a check exactly as before (no `check` field)", async () => {
    const root = await temporaryRoot();
    const changeDir = path.join(root, "openspec", "changes", "active-change");
    await mkdir(changeDir, { recursive: true });
    await writeFile(path.join(changeDir, "tasks.md"), "- [ ] Plain task, no declaration\n");

    const items = await readTaskChecklist(root, "active-change", false);

    expect(items).toEqual([{ lineNumber: 0, text: "Plain task, no declaration", done: false }]);
    expect(items[0]?.check).toBeUndefined();
  });

  it("parses a task carrying a bare check declaration", async () => {
    const root = await temporaryRoot();
    const changeDir = path.join(root, "openspec", "changes", "active-change");
    await mkdir(changeDir, { recursive: true });
    await writeFile(path.join(changeDir, "tasks.md"), "- [ ] npm run typecheck is green. `check(typecheck)`\n");

    const items = await readTaskChecklist(root, "active-change", false);

    expect(items).toEqual([
      {
        lineNumber: 0,
        text: "npm run typecheck is green. `check(typecheck)`",
        done: false,
        check: { name: "typecheck" },
      },
    ]);
  });

  it("parses a task carrying a check declaration with a parameter", async () => {
    const root = await temporaryRoot();
    const changeDir = path.join(root, "openspec", "changes", "active-change");
    await mkdir(changeDir, { recursive: true });
    await writeFile(
      path.join(changeDir, "tasks.md"),
      "- [ ] `git diff packages/core/src/agents/` is empty. `check(path-unchanged, packages/core/src/agents/)`\n",
    );

    const items = await readTaskChecklist(root, "active-change", false);

    expect(items[0]?.check).toEqual({ name: "path-unchanged", param: "packages/core/src/agents/" });
  });

  it("throws UnknownMechanicalCheckError for an unrecognized check name", async () => {
    const root = await temporaryRoot();
    const changeDir = path.join(root, "openspec", "changes", "active-change");
    await mkdir(changeDir, { recursive: true });
    await writeFile(path.join(changeDir, "tasks.md"), "- [ ] A misspelled check. `check(typechek)`\n");

    await expect(readTaskChecklist(root, "active-change", false)).rejects.toThrow(UnknownMechanicalCheckError);
  });

  it("throws InvalidMechanicalCheckParameterError for a path-unchanged path that escapes the workspace", async () => {
    const root = await temporaryRoot();
    const changeDir = path.join(root, "openspec", "changes", "active-change");
    await mkdir(changeDir, { recursive: true });
    await writeFile(
      path.join(changeDir, "tasks.md"),
      "- [ ] Sneaky task. `check(path-unchanged, ../../outside-the-repo)`\n",
    );

    await expect(readTaskChecklist(root, "active-change", false)).rejects.toThrow(
      InvalidMechanicalCheckParameterError,
    );
  });
});

describe("deleteTaskLine", () => {
  it("removes exactly the matching line and preserves the rest of the file", async () => {
    const root = await temporaryRoot();
    const changeDir = path.join(root, "openspec", "changes", "active-change");
    await mkdir(changeDir, { recursive: true });
    const tasksPath = path.join(changeDir, "tasks.md");
    await writeFile(tasksPath, "## 1. Setup\n\n- [ ] 1.1 First task\n- [ ] 1.2 Second task\n");

    await deleteTaskLine(root, "active-change", false, 2, "1.1 First task");

    expect(await readFile(tasksPath, "utf8")).toBe("## 1. Setup\n\n- [ ] 1.2 Second task\n");
  });

  it("preserves CRLF line endings when the original file used them", async () => {
    const root = await temporaryRoot();
    const changeDir = path.join(root, "openspec", "changes", "active-change");
    await mkdir(changeDir, { recursive: true });
    const tasksPath = path.join(changeDir, "tasks.md");
    await writeFile(tasksPath, "- [ ] First\r\n- [ ] Second\r\n");

    await deleteTaskLine(root, "active-change", false, 0, "First");

    expect(await readFile(tasksPath, "utf8")).toBe("- [ ] Second\r\n");
  });

  it("throws TaskListChangedError and makes no change when the line number is stale", async () => {
    const root = await temporaryRoot();
    const changeDir = path.join(root, "openspec", "changes", "active-change");
    await mkdir(changeDir, { recursive: true });
    const tasksPath = path.join(changeDir, "tasks.md");
    const original = "- [ ] First\n- [ ] Second\n";
    await writeFile(tasksPath, original);

    await expect(deleteTaskLine(root, "active-change", false, 0, "A task that no longer exists")).rejects.toThrow(
      TaskListChangedError,
    );
    expect(await readFile(tasksPath, "utf8")).toBe(original);
  });

  it("throws TaskListChangedError for an unknown change without creating any file", async () => {
    const root = await temporaryRoot();

    await expect(deleteTaskLine(root, "does-not-exist", false, 0, "text")).rejects.toThrow(TaskListChangedError);
  });
});

describe("getArchivedChangeSummary", () => {
  it("counts completed/total tasks and reports tasks.md's mtime", async () => {
    const root = await temporaryRoot();
    const changeDir = path.join(root, "openspec", "changes", "archive", "old-change");
    await mkdir(changeDir, { recursive: true });
    const tasksPath = path.join(changeDir, "tasks.md");
    await writeFile(tasksPath, "- [x] Done\n- [ ] Not done\n- [x] Also done\n");

    const summary = await getArchivedChangeSummary(root, "old-change");
    const expectedMtime = (await stat(tasksPath)).mtime.toISOString();

    expect(summary).toEqual({ completedTasks: 2, totalTasks: 3, lastModified: expectedMtime });
  });

  it("returns zero counts and the change directory's mtime when tasks.md is missing", async () => {
    const root = await temporaryRoot();
    const changeDir = path.join(root, "openspec", "changes", "archive", "old-change");
    await mkdir(changeDir, { recursive: true });
    await writeFile(path.join(changeDir, "proposal.md"), "# Proposal\n");

    const summary = await getArchivedChangeSummary(root, "old-change");
    const expectedMtime = (await stat(changeDir)).mtime.toISOString();

    expect(summary).toEqual({ completedTasks: 0, totalTasks: 0, lastModified: expectedMtime });
  });

  it("returns zero counts and the epoch for an unknown change name", async () => {
    const root = await temporaryRoot();

    expect(await getArchivedChangeSummary(root, "does-not-exist")).toEqual({
      completedTasks: 0,
      totalTasks: 0,
      lastModified: new Date(0).toISOString(),
    });
  });
});

// tasks.md 6.3: none of this repository's own real tasks.md files use the
// new `` `check(...)` `` syntax, so every one of them must still parse
// with the exact same items an independent, syntax-agnostic count of
// `- [ ]`/`- [x]` lines produces — this is what would break if the
// parser's understanding of an ordinary task line shifted even slightly
// (task 2.2's "every existing tasks.md ... must parse identically").
describe("readTaskChecklist over this repository's own openspec/changes/*/tasks.md (task 6.3)", () => {
  // Reads and parses every tasks.md in the repository — around twenty
  // files today and one more with each change — so it grows with the
  // repository and needs a ceiling that does not. Measured at ~2 s alone;
  // it timed out at the 5000 ms default under a full-suite run. See
  // load-sensitive-test-timeouts.
  it("parses every real tasks.md without throwing, with counts matching an independent line count", async () => {
    const repoRoot = path.resolve(__dirname, "..", "..", "..");
    const changesRoot = path.join(repoRoot, "openspec", "changes");
    const entries = await import("node:fs/promises").then((fs) => fs.readdir(changesRoot, { withFileTypes: true }));
    const changeDirs = entries.filter((entry) => entry.isDirectory()).map((entry) => entry.name);
    expect(changeDirs.length).toBeGreaterThan(0);

    for (const changeName of changeDirs) {
      const tasksPath = path.join(changesRoot, changeName, "tasks.md");
      let raw: string;
      try {
        raw = await readFile(tasksPath, "utf8");
      } catch {
        continue; // no tasks.md for this change — nothing to compare
      }
      // Independent of TASK_CHECKBOX_LINE_RE: a plain count of checkbox
      // lines by eye, the same shape a human reviewer would count.
      const expectedCount = raw.split(/\r?\n/).filter((line) => /^[ \t]*-\s\[[ xX]\]/.test(line)).length;

      const items = await readTaskChecklist(repoRoot, changeName, false);
      expect(items.length).toBe(expectedCount);
      // None of these files' actual task lines declare a check today —
      // prose describing the syntax (as this very change's own tasks.md
      // does, e.g. "may carry a `check(...)` declaration") is not the
      // same as a task line ending in one, so this asserts on the parsed
      // result, not a raw-text search that would also match that prose.
      expect(items.every((item) => item.check === undefined)).toBe(true);
    }
  });
});
