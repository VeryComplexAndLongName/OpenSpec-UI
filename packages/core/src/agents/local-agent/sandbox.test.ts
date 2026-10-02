import { mkdir, mkdtemp, rm, symlink, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";
import { OutsideWorkingDirectoryError, resolveInside } from "./sandbox.js";

// local-llm-codes-in-process 2.2: by real path, not by `path.resolve` alone.
// Temporary directories: the file took 150 ms alone on 2026-10-02; the ceiling is the
// one the other local-agent tests use, for a loaded machine.
vi.setConfig({ testTimeout: 20_000 });
const roots: string[] = [];
afterEach(async () => {
  await Promise.all(roots.splice(0).map((root) => rm(root, { recursive: true, force: true })));
});

async function tree(): Promise<{ cwd: string; outside: string }> {
  const root = await mkdtemp(path.join(os.tmpdir(), "openspec-sandbox-"));
  roots.push(root);
  const cwd = path.join(root, "work");
  const outside = path.join(root, "outside");
  await mkdir(path.join(cwd, "src"), { recursive: true });
  await mkdir(outside, { recursive: true });
  await writeFile(path.join(outside, "secret.txt"), "no", "utf8");
  return { cwd, outside };
}

describe("resolveInside", () => {
  it("answers a path inside, existing or not yet written", async () => {
    const { cwd } = await tree();
    expect(await resolveInside(cwd, "src")).toBe(path.join(await (await import("node:fs/promises")).realpath(cwd), "src"));
    await expect(resolveInside(cwd, "src/new/deep.txt")).resolves.toContain(path.join("src", "new", "deep.txt"));
  });

  it("refuses ..", async () => {
    const { cwd } = await tree();
    await expect(resolveInside(cwd, "../outside/secret.txt")).rejects.toBeInstanceOf(OutsideWorkingDirectoryError);
  });

  it("refuses an absolute path elsewhere", async () => {
    const { cwd, outside } = await tree();
    await expect(resolveInside(cwd, path.join(outside, "secret.txt"))).rejects.toBeInstanceOf(OutsideWorkingDirectoryError);
  });

  it("refuses a link inside the directory that points outside it", async () => {
    const { cwd, outside } = await tree();
    try {
      await symlink(outside, path.join(cwd, "link"), process.platform === "win32" ? "junction" : "dir");
    } catch {
      return; // A machine that cannot make links cannot be escaped through one.
    }
    await expect(resolveInside(cwd, "link/secret.txt")).rejects.toBeInstanceOf(OutsideWorkingDirectoryError);
    await expect(resolveInside(cwd, "link/new.txt")).rejects.toBeInstanceOf(OutsideWorkingDirectoryError);
  });
});
