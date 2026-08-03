import { mkdtemp, mkdir, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { deriveChangeState, readChangeState } from "./change-state.js";

const EMPTY_TASKS = "## 1. Секция\n\nПросто текст, без пунктов.\n";
const UNCHECKED_TASKS = "## 1. Секция\n\n- [ ] Первая задача\n- [ ] Вторая задача\n";
const PARTIAL_TASKS = "## 1. Секция\n\n- [x] Первая задача\n- [ ] Вторая задача\n- [ ] Третья задача\n";
const COMPLETE_TASKS = "## 1. Секция\n\n- [x] Первая задача\n- [X] Вторая задача\n";

describe("deriveChangeState (pure)", () => {
  it("draft: tasks.md отсутствует", () => {
    expect(deriveChangeState("/repo/openspec/changes/my-change", null)).toBe("draft");
  });

  it("draft: tasks.md без пунктов чеклиста", () => {
    expect(deriveChangeState("/repo/openspec/changes/my-change", EMPTY_TASKS)).toBe("draft");
  });

  it("draft: все пункты не отмечены", () => {
    expect(deriveChangeState("/repo/openspec/changes/my-change", UNCHECKED_TASKS)).toBe("draft");
  });

  it("in-progress: часть пунктов отмечена", () => {
    expect(deriveChangeState("/repo/openspec/changes/my-change", PARTIAL_TASKS)).toBe("in-progress");
  });

  it("implemented: все пункты отмечены, не в archive/", () => {
    expect(deriveChangeState("/repo/openspec/changes/my-change", COMPLETE_TASKS)).toBe("implemented");
  });

  it("archived: директория под changes/archive/, даже если tasks.md неполный", () => {
    expect(deriveChangeState("/repo/openspec/changes/archive/my-change", PARTIAL_TASKS)).toBe("archived");
  });

  it("archived: работает и с обратными слэшами (Windows-пути)", () => {
    expect(deriveChangeState("C:\\repo\\openspec\\changes\\archive\\my-change", COMPLETE_TASKS)).toBe("archived");
  });

  it("не путает 'archive' как часть имени change'а с директорией archive/", () => {
    // "archive-tooling-change" содержит подстроку "archive", но НЕ является
    // сегментом пути "archive" — не должен считаться заархивированным.
    expect(deriveChangeState("/repo/openspec/changes/archive-tooling-change", PARTIAL_TASKS)).toBe("in-progress");
  });
});

describe("readChangeState (fixtures on disk)", () => {
  let root: string;

  afterEach(async () => {
    if (root) await rm(root, { recursive: true, force: true });
  });

  it("draft: change с пустым tasks.md", async () => {
    root = await mkdtemp(path.join(tmpdir(), "openspec-fixture-"));
    const changeDir = path.join(root, "changes", "empty-change");
    await mkdir(changeDir, { recursive: true });
    await writeFile(path.join(changeDir, "tasks.md"), UNCHECKED_TASKS, "utf8");
    expect(await readChangeState(changeDir)).toBe("draft");
  });

  it("draft: change без tasks.md вовсе", async () => {
    root = await mkdtemp(path.join(tmpdir(), "openspec-fixture-"));
    const changeDir = path.join(root, "changes", "no-tasks-change");
    await mkdir(changeDir, { recursive: true });
    expect(await readChangeState(changeDir)).toBe("draft");
  });

  it("in-progress: change с частично отмеченным tasks.md", async () => {
    root = await mkdtemp(path.join(tmpdir(), "openspec-fixture-"));
    const changeDir = path.join(root, "changes", "partial-change");
    await mkdir(changeDir, { recursive: true });
    await writeFile(path.join(changeDir, "tasks.md"), PARTIAL_TASKS, "utf8");
    expect(await readChangeState(changeDir)).toBe("in-progress");
  });

  it("implemented: change с полностью отмеченным tasks.md, не в archive", async () => {
    root = await mkdtemp(path.join(tmpdir(), "openspec-fixture-"));
    const changeDir = path.join(root, "changes", "done-change");
    await mkdir(changeDir, { recursive: true });
    await writeFile(path.join(changeDir, "tasks.md"), COMPLETE_TASKS, "utf8");
    expect(await readChangeState(changeDir)).toBe("implemented");
  });

  it("archived: change физически лежит в changes/archive/", async () => {
    root = await mkdtemp(path.join(tmpdir(), "openspec-fixture-"));
    const changeDir = path.join(root, "changes", "archive", "old-change");
    await mkdir(changeDir, { recursive: true });
    await writeFile(path.join(changeDir, "tasks.md"), COMPLETE_TASKS, "utf8");
    expect(await readChangeState(changeDir)).toBe("archived");
  });
});
