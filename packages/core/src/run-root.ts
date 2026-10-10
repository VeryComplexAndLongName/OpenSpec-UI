// The agents a run is given, by where it runs (a-change-runs-in-its-own-
// worktree).
//
// A host binds its agents to one root, its workspace, and each agent's
// sandbox refuses a run whose `cwd` is outside it. A change is made in a
// worktree of its own (ADR 0043), under `<worktree root>/<repository>/`,
// which is not inside the workspace: a run of such a change from its card
// failed with "cwd ... is outside the workspace". The CLI never met this:
// `openspec-ui-cli run change --cwd` builds its agents for that directory.
//
// So a host gives a run inside one of its repository's worktrees that
// worktree's own agents, made once per worktree, and every other run the
// workspace's - whose sandbox still refuses a directory that is neither.

import path from "node:path";
import type { AgentRunner } from "./agent-runner.js";

function key(directory: string): string {
  const resolved = path.resolve(directory);
  return process.platform === "win32" ? resolved.toLowerCase() : resolved;
}

function within(child: string, parent: string): boolean {
  const c = key(child);
  const p = key(parent);
  return c === p || c.startsWith(p.endsWith(path.sep) ? p : `${p}${path.sep}`);
}

/** The root a run in `cwd` is bound to: the workspace for a run inside it;
 * the worktree's own directory for a run inside one under `container`
 * (`<worktree root>/<repository>`); `undefined` for anywhere else. */
export function runRootOf(cwd: string, workspaceRoot: string, container: string | undefined): string | undefined {
  if (within(cwd, workspaceRoot)) return path.resolve(workspaceRoot);
  if (container === undefined || !within(cwd, container) || key(cwd) === key(container)) return undefined;
  const first = path.relative(path.resolve(container), path.resolve(cwd)).split(path.sep)[0];
  return first === undefined || first.length === 0 ? undefined : path.join(path.resolve(container), first);
}

/** A host's agents by where a run runs: the workspace's own for a run in
 * the workspace or anywhere unknown (whose sandbox then refuses it), and a
 * worktree's own, made once, for a run in one of the repository's
 * worktrees. */
export function agentsByRunRoot(options: {
  workspaceRoot: string;
  /** The workspace's agents. */
  runners: Map<string, AgentRunner>;
  /** `<worktree root>/<repository>`, once read; `undefined` until then. */
  container: () => string | undefined;
  /** Builds the agents of another root, as `runners` was built. Absent,
   * every run gets `runners`. */
  runnersFor?: (root: string) => Map<string, AgentRunner>;
}): (cwd: string | undefined) => Map<string, AgentRunner> {
  const made = new Map<string, Map<string, AgentRunner>>();
  return (cwd) => {
    if (cwd === undefined || options.runnersFor === undefined) return options.runners;
    const root = runRootOf(cwd, options.workspaceRoot, options.container());
    if (root === undefined || key(root) === key(options.workspaceRoot)) return options.runners;
    let agents = made.get(key(root));
    if (agents === undefined) {
      agents = options.runnersFor(root);
      made.set(key(root), agents);
    }
    return agents;
  };
}
