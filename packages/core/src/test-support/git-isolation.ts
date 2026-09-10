// Git as a fixture needs it: nothing from the machine the tests run on.
//
// A fixture that commits inherits the developer's global configuration.
// `commit.gpgsign = true` makes every fixture commit ask a signing key
// for a passphrase and fail when nothing answers; `core.hooksPath`
// pointed at a shared hooks directory runs that directory's `pre-commit`
// against a temporary tree that is not this repository. Either fails the
// test for a reason that has nothing to do with the code under test, on
// one machine and not another — a green suite that means "this machine",
// not "this code". See a-check-that-passes-checked-something.
//
// Exported from the package as `@openspec-ui/core/test-support/
// git-isolation` rather than from the index: `server`'s e2e fixtures
// commit too and read this same list, and the product API is not the
// place for test support.

import { mkdtemp } from "node:fs/promises";
import os from "node:os";
import path from "node:path";

let emptyHooksDir: Promise<string> | undefined;

/** An empty directory, made once per process.
 *
 * There is no git setting for "run no hooks" — `core.hooksPath` takes a
 * directory, so the way to run none is to point it at a directory that
 * holds none. `--no-verify` covers only the commit hooks and only where
 * the call site can pass it, which a `simple-git` `commit()` cannot. */
function noHooksDir(): Promise<string> {
  emptyHooksDir ??= mkdtemp(path.join(os.tmpdir(), "openspec-no-hooks-"));
  return emptyHooksDir;
}

/** `-c` settings for a git that ignores the machine's own configuration. */
async function isolationSettings(): Promise<string[]> {
  return ["commit.gpgsign=false", `core.hooksPath=${await noHooksDir()}`];
}

/** What `simple-git` takes: the settings, plus its permission to send
 * one of them.
 *
 * `simple-git` refuses `core.hooksPath` outright — "Configuring
 * core.hooksPath is not permitted without enabling allowUnsafeHooksPath"
 * — because a `-c` switch that names a hooks directory is a way to run
 * arbitrary code, and the library cannot tell a caller's own temporary
 * directory from a path that arrived in a request. Here it is the
 * former: the directory is made by `mkdtemp` in this process and holds
 * nothing. */
export async function gitIsolationOptions(): Promise<{
  config: string[];
  unsafe: { allowUnsafeHooksPath: true };
}> {
  return { config: await isolationSettings(), unsafe: { allowUnsafeHooksPath: true } };
}

/** The same settings as arguments, for a raw `git` call: they go before
 * the subcommand, so spread this ahead of it. */
export async function gitIsolationArgs(): Promise<string[]> {
  return (await isolationSettings()).flatMap((setting) => ["-c", setting]);
}
