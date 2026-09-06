// Resolves which npm script a workspace wants run for a given mechanical
// check ("typecheck"/"test"/"lint") — see
// openspec/changes/openspec-commands-in-vscode/design.md, "Decision: three
// ways to resolve, in a stated order". Business logic belongs here (core),
// not in the extension that calls it, per docs/adr/0001.

import { readFile } from "node:fs/promises";
import path from "node:path";

export const CHECK_SCRIPT_NAMES = ["typecheck", "test", "lint"] as const;

export type CheckScriptName = (typeof CHECK_SCRIPT_NAMES)[number];

/** `openspec-ui.checks` setting shape — a check name mapped to the exact
 * npm script to run for it. Wins over both conventions below. */
export type CheckScriptSettings = Partial<Record<CheckScriptName, string>>;

async function readPackageScripts(workspaceRoot: string): Promise<Record<string, string>> {
  try {
    const raw = await readFile(path.join(workspaceRoot, "package.json"), "utf8");
    const parsed = JSON.parse(raw) as { scripts?: unknown };
    const scripts = parsed.scripts;
    if (scripts && typeof scripts === "object") {
      return scripts as Record<string, string>;
    }
    return {};
  } catch {
    // No package.json, unreadable, or invalid JSON — same as "declares
    // nothing" for resolution purposes; not an error to surface here.
    return {};
  }
}

/** Resolves against a workspace's `package.json`, in the order design.md
 * states: the matching `settings` entry, then `osui-<name>`, then `<name>`,
 * then nothing. A check absent from the result means the workspace does
 * not declare it — callers must not invent a fallback command for it. */
export async function resolveCheckScripts(
  workspaceRoot: string,
  settings: CheckScriptSettings = {},
): Promise<CheckScriptSettings> {
  const scripts = await readPackageScripts(workspaceRoot);
  const resolved: CheckScriptSettings = {};
  for (const name of CHECK_SCRIPT_NAMES) {
    const explicit = settings[name];
    if (explicit) {
      resolved[name] = explicit;
      continue;
    }
    const prefixed = `osui-${name}`;
    if (Object.prototype.hasOwnProperty.call(scripts, prefixed)) {
      resolved[name] = prefixed;
      continue;
    }
    if (Object.prototype.hasOwnProperty.call(scripts, name)) {
      resolved[name] = name;
    }
  }
  return resolved;
}
