// Where working directories go — ADR 0027.
//
// One root for every repository, at `<root>/<repository>/<change>`,
// instead of one container beside each repository. The folder a person
// keeps repositories in stays a folder of repositories.
//
// The root is a setting of the machine and NOT of the repository. It is
// read from the environment and from a file belonging to the person, and
// deliberately never from `openspec/config.yaml`: that file travels to
// every checkout, and one person's disk layout is not a fact about the
// project. A setting placed there arrives on machines whose owner never
// chose it.

import { readFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";

/** Read before the user-level file, so a single run can be pointed
 * somewhere else without editing anything. */
export const WORKTREE_ROOT_ENV = "OPENSPEC_UI_WORKTREE_ROOT";

/** The person's own setting, beside the other per-user state of this
 * tool rather than inside any repository. */
export function userWorktreeRootFile(homeDirectory = os.homedir()): string {
  return path.join(homeDirectory, ".openspec-ui", "settings.json");
}

export interface WorktreeRootSources {
  /** Defaults to `process.env`. */
  env?: Record<string, string | undefined>;
  /** Defaults to the user's home directory. */
  homeDirectory?: string;
}

/** Where the root came from. Carried so a person who is surprised by a
 * path can be told which of the three decided it, rather than having to
 * guess between an environment variable they forgot and a file they have
 * never opened. */
export type WorktreeRootOrigin = "environment" | "settings" | "default";

export interface ResolvedWorktreeRoot {
  root: string;
  origin: WorktreeRootOrigin;
}

/** The default: a hidden directory beside the repository's own parent.
 *
 * Chosen over somewhere further away for two reasons. It is where a
 * person already keeps this work, so nothing moves house. And it is
 * short — Windows still stops at 260 characters, and a monorepo's nested
 * `node_modules` under a long temporary path is how that limit is
 * actually met. */
export function defaultWorktreeRoot(repositoryRoot: string): string {
  return path.join(path.dirname(path.resolve(repositoryRoot)), ".worktrees");
}

/** Resolves the root: the environment, then the person's settings, then
 * the default. Never the repository's own configuration. */
export async function resolveWorktreeRoot(
  repositoryRoot: string,
  sources: WorktreeRootSources = {},
): Promise<ResolvedWorktreeRoot> {
  const env = sources.env ?? process.env;
  const fromEnv = env[WORKTREE_ROOT_ENV]?.trim();
  if (fromEnv) return { root: path.resolve(fromEnv), origin: "environment" };

  const fromSettings = await readSettingsRoot(userWorktreeRootFile(sources.homeDirectory));
  if (fromSettings) return { root: path.resolve(fromSettings), origin: "settings" };

  return { root: defaultWorktreeRoot(repositoryRoot), origin: "default" };
}

async function readSettingsRoot(filePath: string): Promise<string | undefined> {
  let parsed: unknown;
  try {
    parsed = JSON.parse(await readFile(filePath, "utf8"));
  } catch {
    // Missing, unreadable, or not JSON. All of them mean the person has
    // not said where, which is not an error — it is the ordinary case,
    // and the default answers it.
    return undefined;
  }
  if (typeof parsed !== "object" || parsed === null) return undefined;
  const value = (parsed as Record<string, unknown>).worktreeRoot;
  return typeof value === "string" && value.trim().length > 0 ? value.trim() : undefined;
}

/** Where one change's working directory goes under a root.
 *
 * The repository segment is what lets one root serve every project: two
 * repositories with a change of the same name would otherwise be handed
 * one path, and the second would be refused for a reason that looked
 * like a bug. */
export function worktreePathUnder(root: string, repositoryRoot: string, changeName: string): string {
  return path.join(path.resolve(root), path.basename(path.resolve(repositoryRoot)), changeName);
}
