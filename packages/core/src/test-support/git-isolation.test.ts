import { execFile } from "node:child_process";
import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { promisify } from "node:util";
import { afterAll, describe, expect, it, vi } from "vitest";
import { gitIsolationArgs, gitIsolationOptions } from "./git-isolation.js";

// a-check-that-passes-checked-something: the fixtures that build git
// histories borrowed the developer's configuration, so they passed on one
// machine and failed on another for a reason unrelated to the code. Each
// test here builds the hostile configuration on purpose, confirms the
// plain call fails under it, and then confirms the isolated call does
// not — an assertion that the isolation works, rather than that nothing
// went wrong on this machine.
//
// Measured 2026-09-10 on an idle 8-core Windows machine: 4/4 in 1.6 s,
// slowest test 0.8 s, spawning ten real `git` processes in total. The
// budget below is emphatically not that figure: sized at 30_000 from it,
// the hooks test then timed out at exactly 30_000 ms in the first full
// `npm run verify`, where 64 other files in this package run beside it —
// a hook spawns `sh` through Git for Windows' MSYS layer, and that is
// what gets slow when the machine is busy. So it is sized like the
// package's other git-spawning files, whose own co-load measurements put
// them at 45_000-130_000 (see `git.push.test.ts` and
// `change-timeline.test.ts`).
//
// The signing test names a `gpg.program` that does not exist rather than
// letting a real gpg refuse: a first run against a fresh `GNUPGHOME`
// spent 33 s starting an agent only to fail, which is a measurement of
// gpg's startup and not of anything this module does.
vi.setConfig({ testTimeout: 120_000 });

const run = promisify(execFile);

const temporaryRoots: string[] = [];

afterAll(async () => {
  // Retried: the git processes that held these directories have exited by
  // now, but on Windows the handles can outlive them by a moment, and the
  // first full-package run of this file failed on `EBUSY: resource busy
  // or locked, rmdir` with every assertion in it passed.
  await Promise.all(temporaryRoots.splice(0).map(
    (root) => rm(root, { recursive: true, force: true, maxRetries: 10, retryDelay: 100 }),
  ));
});

async function temporaryRoot(): Promise<string> {
  const root = await mkdtemp(path.join(os.tmpdir(), "openspec-git-isolation-"));
  temporaryRoots.push(root);
  return root;
}

/** A repository with one staged file, and the environment that makes git
 * read `globalConfig` as the machine's own global configuration.
 *
 * `GIT_CONFIG_GLOBAL` is how a test states "this developer has that in
 * `~/.gitconfig`" without touching the developer's `~/.gitconfig`. */
async function repoWithHostileGlobalConfig(globalConfig: string): Promise<{
  repo: string;
  env: NodeJS.ProcessEnv;
}> {
  const root = await temporaryRoot();
  const repo = path.join(root, "repo");
  await mkdir(repo, { recursive: true });
  await writeFile(path.join(root, "gitconfig"), globalConfig, "utf8");

  const env: NodeJS.ProcessEnv = {
    ...process.env,
    GIT_CONFIG_GLOBAL: path.join(root, "gitconfig"),
    GIT_AUTHOR_NAME: "Fixture",
    GIT_AUTHOR_EMAIL: "fixture@example.com",
    GIT_COMMITTER_NAME: "Fixture",
    GIT_COMMITTER_EMAIL: "fixture@example.com",
  };

  await run("git", ["init", "-q"], { cwd: repo, env });
  await writeFile(path.join(repo, "a.txt"), "a\n", "utf8");
  await run("git", ["add", "a.txt"], { cwd: repo, env });
  return { repo, env };
}

async function commitFails(repo: string, env: NodeJS.ProcessEnv, args: string[] = []): Promise<boolean> {
  try {
    await run("git", [...args, "commit", "-q", "-m", "fixture"], { cwd: repo, env });
    return false;
  } catch {
    return true;
  }
}

describe("gitIsolationArgs", () => {
  it("commits where the machine's configuration requires a signature", async () => {
    // A signer that cannot run: git refuses the commit rather than
    // writing an unsigned one, which is the shape of the real failure —
    // a key whose passphrase nothing answers.
    const { repo, env } = await repoWithHostileGlobalConfig(
      "[commit]\n\tgpgsign = true\n[gpg]\n\tprogram = openspec-no-such-signer\n",
    );

    expect(await commitFails(repo, env)).toBe(true);
    expect(await commitFails(repo, env, await gitIsolationArgs())).toBe(false);
  });

  it("commits where the machine's configuration points at a hooks directory", async () => {
    const root = await temporaryRoot();
    const hooks = path.join(root, "hooks");
    await mkdir(hooks, { recursive: true });
    // A hook that refuses everything: a shared `core.hooksPath` holds
    // hooks written for one repository, and a fixture's temporary tree is
    // not that repository.
    await writeFile(path.join(hooks, "pre-commit"), "#!/bin/sh\nexit 1\n", { encoding: "utf8", mode: 0o755 });
    const { repo, env } = await repoWithHostileGlobalConfig(
      `[core]\n\thooksPath = ${hooks.replaceAll("\\", "/")}\n`,
    );

    expect(await commitFails(repo, env)).toBe(true);
    expect(await commitFails(repo, env, await gitIsolationArgs())).toBe(false);
  });

  it("names both settings, as `-c` arguments before the subcommand", async () => {
    const args = await gitIsolationArgs();
    expect(args.filter((arg) => arg === "-c")).toHaveLength(2);
    expect(args).toContain("commit.gpgsign=false");
    expect(args.some((arg) => arg.startsWith("core.hooksPath="))).toBe(true);
  });

  it("gives simple-git the same settings and its permission to send them", async () => {
    // Without the flag, `simple-git` refuses the whole call: "Configuring
    // core.hooksPath is not permitted without enabling
    // allowUnsafeHooksPath". Twenty-eight tests in this package failed
    // that way before it was passed.
    const options = await gitIsolationOptions();
    expect(options.config).toEqual(await gitIsolationArgs().then((args) => args.filter((arg) => arg !== "-c")));
    expect(options.unsafe.allowUnsafeHooksPath).toBe(true);
  });
});
