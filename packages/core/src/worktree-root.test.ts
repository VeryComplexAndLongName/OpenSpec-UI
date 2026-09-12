import { mkdtemp, mkdir, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  WORKTREE_ROOT_ENV,
  defaultWorktreeRoot,
  resolveWorktreeRoot,
  userWorktreeRootFile,
  worktreePathUnder,
} from "./worktree-root.js";

// every-varying-check-has-a-budget: no subprocess and no git — one small
// file write at most. Measured 2026-09-12 under 20ms for the slowest.
vi.setConfig({ testTimeout: 15_000 });

const temporaryRoots: string[] = [];

async function temporaryHome(settings?: Record<string, unknown>): Promise<string> {
  const home = await mkdtemp(path.join(os.tmpdir(), "openspec-ui-home-"));
  temporaryRoots.push(home);
  if (settings) {
    await mkdir(path.dirname(userWorktreeRootFile(home)), { recursive: true });
    await writeFile(userWorktreeRootFile(home), JSON.stringify(settings), "utf8");
  }
  return home;
}

afterEach(async () => {
  await Promise.all(temporaryRoots.splice(0).map((root) => rm(root, { recursive: true, force: true })));
});

const REPOSITORY = path.resolve(path.join(path.sep, "home", "me", "repo"));

describe("resolveWorktreeRoot", () => {
  it("defaults to one hidden directory beside the repository's parent", async () => {
    const home = await temporaryHome();

    const resolved = await resolveWorktreeRoot(REPOSITORY, { env: {}, homeDirectory: home });

    // One directory for every repository, where a person already keeps
    // this work — and short, because Windows still stops at 260.
    expect(resolved).toEqual({ root: path.join(path.dirname(REPOSITORY), ".worktrees"), origin: "default" });
  });

  it("takes the person's setting over the default", async () => {
    const home = await temporaryHome({ worktreeRoot: path.join(path.sep, "elsewhere", "work") });

    const resolved = await resolveWorktreeRoot(REPOSITORY, { env: {}, homeDirectory: home });

    expect(resolved.origin).toBe("settings");
    expect(resolved.root).toBe(path.resolve(path.join(path.sep, "elsewhere", "work")));
  });

  it("takes the environment over the person's setting", async () => {
    const home = await temporaryHome({ worktreeRoot: path.join(path.sep, "elsewhere", "work") });
    const env = { [WORKTREE_ROOT_ENV]: path.join(path.sep, "just", "this", "once") };

    const resolved = await resolveWorktreeRoot(REPOSITORY, { env, homeDirectory: home });

    // So one run can be pointed somewhere else without editing anything.
    expect(resolved.origin).toBe("environment");
    expect(resolved.root).toBe(path.resolve(path.join(path.sep, "just", "this", "once")));
  });

  it("falls back where the setting is missing, unreadable or empty", async () => {
    const blank = await temporaryHome({ worktreeRoot: "   " });
    const wrongType = await temporaryHome({ worktreeRoot: 42 });
    const none = await temporaryHome();

    for (const home of [blank, wrongType, none]) {
      // Not an error: a person who has said nothing is the ordinary
      // case, and the default is the answer to it.
      expect((await resolveWorktreeRoot(REPOSITORY, { env: {}, homeDirectory: home })).origin).toBe("default");
    }
  });

  it("ignores a settings file that is not JSON at all", async () => {
    const home = await temporaryHome();
    await mkdir(path.dirname(userWorktreeRootFile(home)), { recursive: true });
    await writeFile(userWorktreeRootFile(home), "this is not json", "utf8");

    expect((await resolveWorktreeRoot(REPOSITORY, { env: {}, homeDirectory: home })).origin).toBe("default");
  });

  it("says which of the three decided, so a surprising path can be explained", async () => {
    const home = await temporaryHome({ worktreeRoot: path.join(path.sep, "elsewhere") });

    const fromSettings = await resolveWorktreeRoot(REPOSITORY, { env: {}, homeDirectory: home });
    const fromEnv = await resolveWorktreeRoot(REPOSITORY, {
      env: { [WORKTREE_ROOT_ENV]: path.join(path.sep, "other") },
      homeDirectory: home,
    });

    // A person surprised by a path should be told which setting decided
    // it, not left to guess between a variable they forgot and a file
    // they have never opened.
    expect([fromSettings.origin, fromEnv.origin]).toEqual(["settings", "environment"]);
  });
});

describe("worktreePathUnder", () => {
  it("names the repository inside the root", async () => {
    const target = worktreePathUnder(path.join(path.sep, "wt"), REPOSITORY, "a-change");

    expect(target).toBe(path.join(path.resolve(path.join(path.sep, "wt")), "repo", "a-change"));
  });

  it("keeps two repositories with a change of one name apart", () => {
    const root = path.join(path.sep, "wt");
    const first = worktreePathUnder(root, path.join(path.sep, "a", "repo-one"), "shared-name");
    const second = worktreePathUnder(root, path.join(path.sep, "b", "repo-two"), "shared-name");

    // Without the repository segment the second would be refused for a
    // reason that looked like a bug.
    expect(first).not.toBe(second);
  });
});

describe("defaultWorktreeRoot", () => {
  it("is outside the repository", () => {
    const root = defaultWorktreeRoot(REPOSITORY);

    // A second copy of the repository inside it is what every recursive
    // tool in the repository walks into.
    expect(root.startsWith(REPOSITORY + path.sep)).toBe(false);
  });
});
