import { mkdtemp, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";
import { resolveCheckScripts } from "./check-script-resolution.js";

// openspec-commands-in-vscode:
// measured 2026-09-06 at 17ms idle for the slowest of its six tests.
// The budget below is the repository floor rather than a figure
// derived from 17ms; this file states one at all because every test
// creates and removes a real temporary directory, which is what the
// budget check flags and what a busy machine slows down.
vi.setConfig({ testTimeout: 15_000 });

// Deliberately not this repo's own package.json (task 1.5): this repo
// happens to declare exactly "lint"/"typecheck"/"test", which would hide
// a bug in the "declares nothing" or "osui-<name>" branches. Every
// fixture below is a temp directory built from scratch.
const temporaryRoots: string[] = [];

async function workspaceWithScripts(scripts: Record<string, string>): Promise<string> {
  const root = await mkdtemp(path.join(os.tmpdir(), "openspec-check-script-resolution-"));
  temporaryRoots.push(root);
  await writeFile(path.join(root, "package.json"), JSON.stringify({ name: "fixture", scripts }), "utf8");
  return root;
}

afterEach(async () => {
  await Promise.all(temporaryRoots.splice(0).map((root) => rm(root, { recursive: true, force: true })));
});

describe("resolveCheckScripts", () => {
  it("prefers the setting over both conventions", async () => {
    const root = await workspaceWithScripts({ lint: "eslint .", "osui-lint": "eslint --quiet ." });

    const resolved = await resolveCheckScripts(root, { lint: "custom-lint-script" });

    expect(resolved.lint).toBe("custom-lint-script");
  });

  it("prefers osui-<name> over the bare name when no setting is given", async () => {
    const root = await workspaceWithScripts({ typecheck: "tsc --noEmit", "osui-typecheck": "tsc --noEmit -p tsconfig.fast.json" });

    const resolved = await resolveCheckScripts(root, {});

    expect(resolved.typecheck).toBe("osui-typecheck");
  });

  it("falls back to the bare name when neither a setting nor osui-<name> exist", async () => {
    const root = await workspaceWithScripts({ test: "vitest run" });

    const resolved = await resolveCheckScripts(root, {});

    expect(resolved.test).toBe("test");
  });

  it("resolves nothing for a check the workspace declares under neither name", async () => {
    const root = await workspaceWithScripts({ build: "tsup" });

    const resolved = await resolveCheckScripts(root, {});

    expect(resolved.typecheck).toBeUndefined();
    expect(resolved.test).toBeUndefined();
    expect(resolved.lint).toBeUndefined();
  });

  it("resolves nothing when the workspace has no package.json at all", async () => {
    const root = await mkdtemp(path.join(os.tmpdir(), "openspec-check-script-resolution-"));
    temporaryRoots.push(root);

    const resolved = await resolveCheckScripts(root, {});

    expect(resolved).toEqual({});
  });

  it("resolves each check independently across mixed declarations", async () => {
    const root = await workspaceWithScripts({ lint: "eslint .", "osui-test": "vitest run --pool=threads" });

    const resolved = await resolveCheckScripts(root, {});

    expect(resolved).toEqual({ lint: "lint", test: "osui-test" });
  });
});
