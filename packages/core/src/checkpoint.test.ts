import { mkdtemp, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import {
  captureCheckpoint,
  deserializeCheckpoint,
  finalizeCheckpoint,
  rollbackCheckpoint,
  rollbackChangeCheckpoints,
  serializeCheckpoint,
} from "./checkpoint.js";

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
    expect(checkpoint.coverage.skippedFiles).toEqual(["large.bin"]);
    expect(checkpoint.coverage.excludedDirectories).toContain("node_modules");
  });

  it("excludes environment files, virtual environments, and generated caches", async () => {
    const root = await temporaryRoot();
    await mkdir(path.join(root, ".venv"), { recursive: true });
    await mkdir(path.join(root, ".mypy_cache"), { recursive: true });
    await mkdir(path.join(root, "src", "__pycache__"), { recursive: true });
    await writeFile(path.join(root, ".env"), "SECRET=value");
    await writeFile(path.join(root, ".eslintcache"), "generated");
    await writeFile(path.join(root, ".venv", "dependency.py"), "ignored");
    await writeFile(path.join(root, ".mypy_cache", "state.json"), "ignored");
    await writeFile(path.join(root, "src", "__pycache__", "module.pyc"), "ignored");
    await writeFile(path.join(root, "tracked.txt"), "tracked");

    const checkpoint = await captureCheckpoint(root);

    expect([...checkpoint.before.keys()]).toEqual(["tracked.txt"]);
    expect(checkpoint.coverage.skippedFiles).toEqual([".env", ".eslintcache"]);
    expect(checkpoint.coverage.excludedDirectories).toEqual(expect.arrayContaining([
      ".mypy_cache",
      ".venv",
      "__pycache__",
    ]));
  });

  it("round-trips persisted checkpoints and rejects unsafe paths", async () => {
    const root = await temporaryRoot();
    await writeFile(path.join(root, "work.txt"), "before");
    const checkpoint = await captureCheckpoint(root);
    await writeFile(path.join(root, "work.txt"), "after");
    await finalizeCheckpoint(checkpoint);

    const serialized = serializeCheckpoint(checkpoint);
    const restored = deserializeCheckpoint(JSON.parse(JSON.stringify(serialized)));
    expect(restored.delta).toEqual(checkpoint.delta);
    expect(restored.before.get("work.txt")?.content.toString()).toBe("before");

    serialized.before[0]!.path = "../outside.txt";
    expect(() => deserializeCheckpoint(serialized)).toThrow("Invalid checkpoint path");
  });

  it("removes newly excluded paths from historical checkpoints", async () => {
    const root = await temporaryRoot();
    await writeFile(path.join(root, "tracked.txt"), "before");
    const checkpoint = await captureCheckpoint(root);
    await writeFile(path.join(root, "tracked.txt"), "after");
    await finalizeCheckpoint(checkpoint);
    const serialized = serializeCheckpoint(checkpoint);
    const snapshot = serialized.before[0]!;
    const afterSnapshot = serialized.after![0]!;
    serialized.before.push({ ...snapshot, path: ".env" });
    serialized.before.push({ ...snapshot, path: ".mypy_cache/cache.json" });
    serialized.after!.push({ ...afterSnapshot, path: ".env" });
    serialized.after!.push({ ...afterSnapshot, path: ".mypy_cache/cache.json" });
    serialized.delta!.push({ path: ".env", kind: "modified" });
    serialized.delta!.push({ path: ".mypy_cache/cache.json", kind: "modified" });

    const restored = deserializeCheckpoint(serialized);

    expect([...restored.before.keys()]).toEqual(["tracked.txt"]);
    expect([...restored.after!.keys()]).toEqual(["tracked.txt"]);
    expect(restored.delta?.map((item) => item.path)).toEqual(["tracked.txt"]);
    expect(restored.coverage.skippedFiles).toContain(".env");
    expect(restored.coverage.excludedDirectories).toContain(".mypy_cache");
  });
});

describe("rollbackChangeCheckpoints", () => {
  it("restores each file to its state before the earliest checkpoint that touched it", async () => {
    const root = await temporaryRoot();
    await writeFile(path.join(root, "shared.txt"), "v0");
    await writeFile(path.join(root, "only-in-first.txt"), "orig1");

    const checkpoint1 = await captureCheckpoint(root);
    await writeFile(path.join(root, "shared.txt"), "v1");
    await rm(path.join(root, "only-in-first.txt"));
    await finalizeCheckpoint(checkpoint1);

    const checkpoint2 = await captureCheckpoint(root);
    await writeFile(path.join(root, "shared.txt"), "v2");
    await writeFile(path.join(root, "only-in-second.txt"), "new2");
    await finalizeCheckpoint(checkpoint2);

    const result = await rollbackChangeCheckpoints([checkpoint1, checkpoint2]);

    expect(result.conflicts).toEqual([]);
    expect(result.restored.sort()).toEqual(["only-in-first.txt", "only-in-second.txt", "shared.txt"]);
    expect(await readFile(path.join(root, "shared.txt"), "utf8")).toBe("v0");
    expect(await readFile(path.join(root, "only-in-first.txt"), "utf8")).toBe("orig1");
    await expect(readFile(path.join(root, "only-in-second.txt"))).rejects.toThrow();
  });

  it("trusts the caller's array order rather than re-sorting by createdAt", async () => {
    // createdAt has millisecond resolution and can tie between two
    // checkpoints captured back to back (confirmed live on a fast CI
    // runner) — sorting by it would then be unreliable with no error.
    // The function trusts input order instead; both real callers already
    // provide it for free via Map iteration order (insertion order).
    const root = await temporaryRoot();
    await writeFile(path.join(root, "shared.txt"), "v0");
    const checkpoint1 = await captureCheckpoint(root);
    await writeFile(path.join(root, "shared.txt"), "v1");
    await finalizeCheckpoint(checkpoint1);
    const checkpoint2 = await captureCheckpoint(root);
    await writeFile(path.join(root, "shared.txt"), "v2");
    await finalizeCheckpoint(checkpoint2);

    const inOrder = await rollbackChangeCheckpoints([checkpoint1, checkpoint2]);
    expect(inOrder.conflicts).toEqual([]);
    expect(await readFile(path.join(root, "shared.txt"), "utf8")).toBe("v0");

    // Passing them out of order doesn't silently restore the wrong
    // content — it fails closed with a conflict, same as any other
    // unexpected on-disk state.
    await writeFile(path.join(root, "shared.txt"), "v2");
    const outOfOrder = await rollbackChangeCheckpoints([checkpoint2, checkpoint1]);
    expect(outOfOrder.conflicts).toEqual(["shared.txt"]);
  });

  it("refuses the entire restore when any file was changed after the latest known state", async () => {
    const root = await temporaryRoot();
    await writeFile(path.join(root, "a.txt"), "a0");
    await writeFile(path.join(root, "b.txt"), "b0");
    const checkpoint = await captureCheckpoint(root);
    await writeFile(path.join(root, "a.txt"), "a1");
    await writeFile(path.join(root, "b.txt"), "b1");
    await finalizeCheckpoint(checkpoint);
    await writeFile(path.join(root, "b.txt"), "user changed it later");

    const result = await rollbackChangeCheckpoints([checkpoint]);

    expect(result).toEqual({ restored: [], conflicts: ["b.txt"] });
    expect(await readFile(path.join(root, "a.txt"), "utf8")).toBe("a1");
    expect(await readFile(path.join(root, "b.txt"), "utf8")).toBe("user changed it later");
  });

  it("throws for an empty checkpoint list", async () => {
    await expect(rollbackChangeCheckpoints([])).rejects.toThrow("No checkpoints to roll back");
  });

  it("throws if a checkpoint was never finalized", async () => {
    const root = await temporaryRoot();
    const checkpoint = await captureCheckpoint(root);
    await expect(rollbackChangeCheckpoints([checkpoint])).rejects.toThrow("Checkpoint must be finalized before rollback");
  });
});
