import { mkdtemp, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { captureCheckpoint, finalizeCheckpoint, rollbackCheckpoint } from "./checkpoint.js";

const roots: string[] = [];

async function temporaryRoot(): Promise<string> {
  const root = await mkdtemp(path.join(os.tmpdir(), "openspec-checkpoint-"));
  roots.push(root);
  return root;
}

afterEach(async () => {
  await Promise.all(roots.splice(0).map((root) => rm(root, { recursive: true, force: true })));
});

describe("Workbench checkpoints", () => {
  it("restores modified, added, and deleted files to their pre-run state", async () => {
    const root = await temporaryRoot();
    await writeFile(path.join(root, "modified.txt"), "user state");
    await writeFile(path.join(root, "deleted.txt"), "keep me");
    const checkpoint = await captureCheckpoint(root);
    await writeFile(path.join(root, "modified.txt"), "agent state");
    await writeFile(path.join(root, "added.txt"), "new file");
    await rm(path.join(root, "deleted.txt"));

    const delta = await finalizeCheckpoint(checkpoint);
    const result = await rollbackCheckpoint(checkpoint);

    expect(delta.map((item) => [item.path, item.kind])).toEqual([
      ["added.txt", "added"],
      ["deleted.txt", "deleted"],
      ["modified.txt", "modified"],
    ]);
    expect(result.conflicts).toEqual([]);
    expect(await readFile(path.join(root, "modified.txt"), "utf8")).toBe("user state");
    expect(await readFile(path.join(root, "deleted.txt"), "utf8")).toBe("keep me");
    await expect(readFile(path.join(root, "added.txt"))).rejects.toThrow();
  });

  it("refuses rollback when a file changed after the run", async () => {
    const root = await temporaryRoot();
    const filePath = path.join(root, "work.txt");
    await writeFile(filePath, "before");
    const checkpoint = await captureCheckpoint(root);
    await writeFile(filePath, "agent");
    await finalizeCheckpoint(checkpoint);
    await writeFile(filePath, "user changed it later");

    const result = await rollbackCheckpoint(checkpoint);

    expect(result).toEqual({ restored: [], conflicts: ["work.txt"] });
    expect(await readFile(filePath, "utf8")).toBe("user changed it later");
  });

  it("skips dependencies, build output, symlinks, and oversized files", async () => {
    const root = await temporaryRoot();
    await mkdir(path.join(root, "node_modules", "pkg"), { recursive: true });
    await mkdir(path.join(root, "dist"), { recursive: true });
    await writeFile(path.join(root, "node_modules", "pkg", "index.js"), "ignored");
    await writeFile(path.join(root, "dist", "bundle.js"), "ignored");
    await writeFile(path.join(root, "large.bin"), Buffer.alloc(32));
    await writeFile(path.join(root, "tracked.txt"), "tracked");

    const checkpoint = await captureCheckpoint(root, { maxFileBytes: 16 });

    expect([...checkpoint.before.keys()]).toEqual(["tracked.txt"]);
  });
});
