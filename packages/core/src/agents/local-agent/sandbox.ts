// Where the local agent's tools may reach: the run's working directory,
// by real path (local-llm-codes-in-process, ADR 0038 decision 3).
//
// `path.resolve` alone is not enough: a link inside `cwd` can point
// outside it. The real path of the target, or of its nearest existing
// ancestor for a file not yet written, must lie inside the real path of
// `cwd` - the check `security.ts` makes for a change's artifacts.

import { realpath } from "node:fs/promises";
import path from "node:path";

export class OutsideWorkingDirectoryError extends Error {
  constructor(readonly requested: string) {
    super(`"${requested}" is outside the working directory`);
  }
}

function isInside(root: string, candidate: string): boolean {
  const relative = path.relative(root, candidate);
  if (relative === "") return true;
  if (path.isAbsolute(relative)) return false;
  return relative !== ".." && !relative.startsWith(`..${path.sep}`);
}

async function realOrNearestAncestor(target: string): Promise<string> {
  let current = target;
  const rest: string[] = [];
  for (;;) {
    try {
      return path.join(await realpath(current), ...rest.reverse());
    } catch {
      const parent = path.dirname(current);
      if (parent === current) return target;
      rest.push(path.basename(current));
      current = parent;
    }
  }
}

/** The absolute path `requested` names, relative to `cwd` or absolute,
 * once its real location is known to be inside `cwd`'s. Throws
 * `OutsideWorkingDirectoryError` otherwise. */
export async function resolveInside(cwd: string, requested: string): Promise<string> {
  const root = await realpath(cwd);
  const target = path.resolve(root, requested);
  if (!isInside(root, target)) throw new OutsideWorkingDirectoryError(requested);
  const real = await realOrNearestAncestor(target);
  const sameCase = process.platform === "win32"
    ? isInside(root.toLowerCase(), real.toLowerCase())
    : isInside(root, real);
  if (!sameCase) throw new OutsideWorkingDirectoryError(requested);
  return target;
}
