import { mkdtemp, mkdir, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { deriveChangeState, readChangeState } from "./change-state.js";

const EMPTY_TASKS = "## 1. Section\n\nJust text, no items.\n";
const UNCHECKED_TASKS = "## 1. Section\n\n- [ ] First task\n- [ ] Second task\n";
const PARTIAL_TASKS = "## 1. Section\n\n- [x] First task\n- [ ] Second task\n- [ ] Third task\n";
const COMPLETE_TASKS = "## 1. Section\n\n- [x] First task\n- [X] Second task\n";

describe("deriveChangeState (pure)", () => {
  it("draft: tasks.md is missing", () => {
    expect(deriveChangeState("/repo/openspec/changes/my-change", null)).toBe("draft");
  });

  it("draft: tasks.md has no checklist items", () => {
    expect(deriveChangeState("/repo/openspec/changes/my-change", EMPTY_TASKS)).toBe("draft");
  });

  it("draft: all items are unchecked", () => {
    expect(deriveChangeState("/repo/openspec/changes/my-change", UNCHECKED_TASKS)).toBe("draft");
  });

  it("in-progress: some items are checked", () => {
    expect(deriveChangeState("/repo/openspec/changes/my-change", PARTIAL_TASKS)).toBe("in-progress");
  });

  it("implemented: all items are checked, not under archive/", () => {
    expect(deriveChangeState("/repo/openspec/changes/my-change", COMPLETE_TASKS)).toBe("implemented");
  });

  it("archived: directory is under changes/archive/, even if tasks.md is incomplete", () => {
    expect(deriveChangeState("/repo/openspec/changes/archive/my-change", PARTIAL_TASKS)).toBe("archived");
  });

  it("archived: also works with backslashes (Windows paths)", () => {
    expect(deriveChangeState("C:\\repo\\openspec\\changes\\archive\\my-change", COMPLETE_TASKS)).toBe("archived");
  });

  it("does not confuse 'archive' as part of a change name with the archive/ directory", () => {
    // "archive-tooling-change" contains the substring "archive", but is NOT
    // an "archive" path segment — it must not be treated as archived.
    expect(deriveChangeState("/repo/openspec/changes/archive-tooling-change", PARTIAL_TASKS)).toBe("in-progress");
  });
});

describe("readChangeState (fixtures on disk)", () => {
  let root: string;

  afterEach(async () => {
    if (root) await rm(root, { recursive: true, force: true });
  });

  it("draft: change with an empty tasks.md", async () => {
    root = await mkdtemp(path.join(tmpdir(), "openspec-fixture-"));
    const changeDir = path.join(root, "changes", "empty-change");
    await mkdir(changeDir, { recursive: true });
    await writeFile(path.join(changeDir, "tasks.md"), UNCHECKED_TASKS, "utf8");
    expect(await readChangeState(changeDir)).toBe("draft");
  });

  it("draft: change with no tasks.md at all", async () => {
    root = await mkdtemp(path.join(tmpdir(), "openspec-fixture-"));
    const changeDir = path.join(root, "changes", "no-tasks-change");
    await mkdir(changeDir, { recursive: true });
    expect(await readChangeState(changeDir)).toBe("draft");
  });

  it("in-progress: change with a partially checked tasks.md", async () => {
    root = await mkdtemp(path.join(tmpdir(), "openspec-fixture-"));
    const changeDir = path.join(root, "changes", "partial-change");
    await mkdir(changeDir, { recursive: true });
    await writeFile(path.join(changeDir, "tasks.md"), PARTIAL_TASKS, "utf8");
    expect(await readChangeState(changeDir)).toBe("in-progress");
  });

  it("implemented: change with a fully checked tasks.md, not under archive", async () => {
    root = await mkdtemp(path.join(tmpdir(), "openspec-fixture-"));
    const changeDir = path.join(root, "changes", "done-change");
    await mkdir(changeDir, { recursive: true });
    await writeFile(path.join(changeDir, "tasks.md"), COMPLETE_TASKS, "utf8");
    expect(await readChangeState(changeDir)).toBe("implemented");
  });

  it("archived: change is physically located under changes/archive/", async () => {
    root = await mkdtemp(path.join(tmpdir(), "openspec-fixture-"));
    const changeDir = path.join(root, "changes", "archive", "old-change");
    await mkdir(changeDir, { recursive: true });
    await writeFile(path.join(changeDir, "tasks.md"), COMPLETE_TASKS, "utf8");
    expect(await readChangeState(changeDir)).toBe("archived");
  });
});
