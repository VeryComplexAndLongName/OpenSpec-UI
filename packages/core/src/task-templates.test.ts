import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { ArchivedChangeNotFoundError, readArchivedChangeTasksTemplate } from "./task-templates.js";

const temporaryRoots: string[] = [];

async function temporaryRoot(): Promise<string> {
  const root = await mkdtemp(path.join(os.tmpdir(), "openspec-task-templates-"));
  temporaryRoots.push(root);
  return root;
}

afterEach(async () => {
  await Promise.all(temporaryRoots.splice(0).map((root) => rm(root, { recursive: true, force: true })));
});

describe("readArchivedChangeTasksTemplate", () => {
  it("resets checkboxes to unchecked while preserving headings and task text", async () => {
    const root = await temporaryRoot();
    const archived = path.join(root, "openspec", "changes", "archive", "old-change");
    await mkdir(archived, { recursive: true });
    await writeFile(
      path.join(archived, "tasks.md"),
      "## 1. Setup\n\n- [x] First task\n- [X] Second task\n- [ ] Third task\n",
    );

    const template = await readArchivedChangeTasksTemplate(root, "old-change");

    expect(template).toBe(
      "## 1. Setup\n\n- [ ] First task\n- [ ] Second task\n- [ ] Third task\n",
    );
  });

  it("returns an empty string when the archived change has no tasks.md", async () => {
    const root = await temporaryRoot();
    const archived = path.join(root, "openspec", "changes", "archive", "old-change");
    await mkdir(archived, { recursive: true });
    await writeFile(path.join(archived, "proposal.md"), "# Proposal\n");

    const template = await readArchivedChangeTasksTemplate(root, "old-change");

    expect(template).toBe("");
  });

  it("rejects a change name that is not an archived change", async () => {
    const root = await temporaryRoot();
    const active = path.join(root, "openspec", "changes", "active-change");
    await mkdir(active, { recursive: true });
    await writeFile(path.join(active, "tasks.md"), "- [x] done\n");

    await expect(readArchivedChangeTasksTemplate(root, "active-change")).rejects.toThrow(
      ArchivedChangeNotFoundError,
    );
  });

  it("rejects a path-traversal-shaped change name without reading outside the archive", async () => {
    const root = await temporaryRoot();
    const archived = path.join(root, "openspec", "changes", "archive", "old-change");
    await mkdir(archived, { recursive: true });
    await writeFile(path.join(archived, "tasks.md"), "- [x] done\n");
    await writeFile(path.join(root, "secret.md"), "should never be read\n");

    await expect(
      readArchivedChangeTasksTemplate(root, "../../secret.md"),
    ).rejects.toThrow(ArchivedChangeNotFoundError);
  });
});
