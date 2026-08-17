import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { TaskListChangedError, deleteTaskLine, readTaskChecklist } from "./task-checklist.js";

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
