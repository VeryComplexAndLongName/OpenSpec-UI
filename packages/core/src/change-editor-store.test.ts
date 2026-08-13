import { mkdtemp, readFile, rename, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import {
  ChangeEditorConflictError,
  readChangeEditorDocument,
  saveChangeEditorDocument,
  type ChangeEditorFiles,
} from "./change-editor-store.js";

const ORIGINAL_FILES: ChangeEditorFiles = {
  proposal: "original proposal",
  design: "original design",
  tasks: "original tasks",
  spec: "original spec",
};

const UPDATED_FILES: ChangeEditorFiles = {
  proposal: "updated proposal",
  design: "updated design",
  tasks: "updated tasks",
  spec: "updated spec",
};

describe("Change Editor store", () => {
  let workspaceRoot: string;

  afterEach(async () => {
    if (workspaceRoot) await rm(workspaceRoot, { recursive: true, force: true });
  });

  async function seedChange(): Promise<void> {
    workspaceRoot = await mkdtemp(path.join(os.tmpdir(), "openspec-editor-store-"));
    const document = await readChangeEditorDocument(workspaceRoot, "safe-save");
    await saveChangeEditorDocument(workspaceRoot, "safe-save", ORIGINAL_FILES, document.revision);
  }

  it("saves all artifacts and returns a new revision", async () => {
    await seedChange();
    const before = await readChangeEditorDocument(workspaceRoot, "safe-save");

    const saved = await saveChangeEditorDocument(
      workspaceRoot,
      "safe-save",
      UPDATED_FILES,
      before.revision,
    );

    expect(saved.files).toEqual(UPDATED_FILES);
    expect(saved.revision).not.toBe(before.revision);
    await expect(readChangeEditorDocument(workspaceRoot, "safe-save")).resolves.toEqual(saved);
  });

  it("rejects a stale revision before modifying files", async () => {
    await seedChange();
    const loaded = await readChangeEditorDocument(workspaceRoot, "safe-save");
    const proposalPath = path.join(workspaceRoot, "openspec", "changes", "safe-save", "proposal.md");
    await writeFile(proposalPath, "external edit", "utf8");

    await expect(saveChangeEditorDocument(
      workspaceRoot,
      "safe-save",
      UPDATED_FILES,
      loaded.revision,
    )).rejects.toBeInstanceOf(ChangeEditorConflictError);
    await expect(readFile(proposalPath, "utf8")).resolves.toBe("external edit");
  });

  it("restores every artifact when replacement fails mid-save", async () => {
    await seedChange();
    const loaded = await readChangeEditorDocument(workspaceRoot, "safe-save");
    let stagedReplacementCount = 0;

    await expect(saveChangeEditorDocument(
      workspaceRoot,
      "safe-save",
      UPDATED_FILES,
      loaded.revision,
      {
        transactionId: () => "injected-failure",
        fileSystem: {
          rename: async (oldPath, newPath) => {
            if (String(oldPath).endsWith(".new") && ++stagedReplacementCount === 2) {
              throw new Error("injected replacement failure");
            }
            await rename(oldPath, newPath);
          },
        },
      },
    )).rejects.toThrow("injected replacement failure");

    const restored = await readChangeEditorDocument(workspaceRoot, "safe-save");
    expect(restored.files).toEqual(ORIGINAL_FILES);
  });
});