// Custom agents a person has defined for their own CLI.
//
// Claude and Copilot both accept one by name — `claude --agent <name>`,
// `copilot --agent <name>` — and both read their definitions from a
// directory. Neither has a command that lists them, and neither needs
// one: the definitions are files, and reading a directory is something
// this project does constantly.
//
// Verified on 2026-09-09 from each CLI's own help. Gemini and Codex are
// absent here: their CLIs are not installed on the machine this was
// written on, so their convention could not be checked, and inventing a
// directory for them would ship a feature that reads nothing. The
// conventions below are data, so adding one later is a line rather than a
// design.

import { readdir, readFile } from "node:fs/promises";
import path from "node:path";
import type { CustomAgent, CustomAgentFamily } from "./custom-agent-family.js";
import { MODEL_ID_PATTERN } from "./harness-step-agent.js";

// `customAgentFamilyFor` and `agentsAcceptingCustomAgents` live in
// `custom-agent-family.ts`, not here: `webui` needs them, and a value
// re-exported from this module would pull `node:fs/promises` into the
// browser bundle. The bundle-safety test caught exactly that.
export type { CustomAgent, CustomAgentFamily };
export { agentsAcceptingCustomAgents, customAgentFamilyFor } from "./custom-agent-family.js";

interface FamilyConvention {
  family: CustomAgentFamily;
  /** Relative to the workspace root. */
  projectDir: string;
  /** Relative to the user's home directory; absent where the CLI reads
   * no user-level directory. */
  userDir?: string;
  extension: string;
}

const CONVENTIONS: readonly FamilyConvention[] = [
  { family: "claude", projectDir: path.join(".claude", "agents"), userDir: path.join(".claude", "agents"), extension: ".md" },
  { family: "copilot", projectDir: path.join(".github", "agents"), extension: ".md" },
];

/** Reads a description from YAML-ish frontmatter, if the file opens with
 * some. Deliberately not a YAML parser: the one field wanted here is a
 * line, and a definition whose frontmatter this cannot read is still a
 * usable agent — its name is the file, which is what the CLI accepts. */
function descriptionFrom(source: string): string | undefined {
  if (!source.startsWith("---")) return undefined;
  const end = source.indexOf("\n---", 3);
  if (end === -1) return undefined;
  for (const line of source.slice(3, end).split("\n")) {
    const match = /^\s*description\s*:\s*(.+?)\s*$/u.exec(line);
    if (match?.[1]) return match[1].replace(/^["']|["']$/gu, "");
  }
  return undefined;
}

async function readDirectory(directory: string, convention: FamilyConvention): Promise<CustomAgent[]> {
  let names: string[];
  try {
    names = (await readdir(directory, { withFileTypes: true }))
      .filter((entry) => entry.isFile() && entry.name.endsWith(convention.extension))
      .map((entry) => entry.name);
  } catch {
    // A missing directory is the ordinary case — most workspaces define
    // none, including this one — and not an error.
    return [];
  }

  const found: CustomAgent[] = [];
  for (const fileName of names) {
    const filePath = path.join(directory, fileName);
    let description: string | undefined;
    try {
      description = descriptionFrom(await readFile(filePath, "utf8"));
    } catch {
      // Unreadable file: still a named agent, just an undescribed one.
    }
    // Discovery and validation agree, or the picker offers a name the
    // save then refuses. The name is a file name, and a file name
    // beginning with `-` is one the CLI may read as a second flag —
    // the same rule, and the same message, as
    // `stepAgents.<stage>.customAgent`.
    const name = fileName.slice(0, -convention.extension.length);
    const refused = MODEL_ID_PATTERN.test(name)
      ? undefined
      : `"${name}" must not begin with "-" and may contain only letters, digits, ".", "_", ":" and "-"`;
    found.push({
      name,
      ...(description !== undefined ? { description } : {}),
      family: convention.family,
      filePath,
      ...(refused !== undefined ? { refused } : {}),
    });
  }
  return found;
}

/** A directory a definition would be read from, whether or not it
 * exists. What a surface needs to say "this workspace defines none" and
 * be useful about it: the answer to "then where would I put one?" is a
 * path, and the surface should not have to rebuild it from a convention
 * it cannot see. */
export interface CustomAgentDirectory {
  family: CustomAgentFamily;
  /** `"project"` is read from the workspace root, `"user"` from the
   * home directory the caller passed. */
  scope: "project" | "user";
  path: string;
}

/** Every directory `findCustomAgents` would read, in the order it reads
 * them. Reported rather than described, so a message naming them cannot
 * drift from the ones actually read. */
export function customAgentDirectories(workspaceRoot: string, homeDir?: string): CustomAgentDirectory[] {
  const directories: CustomAgentDirectory[] = [];
  for (const convention of CONVENTIONS) {
    if (convention.userDir !== undefined && homeDir !== undefined) {
      directories.push({ family: convention.family, scope: "user", path: path.join(homeDir, convention.userDir) });
    }
    directories.push({ family: convention.family, scope: "project", path: path.join(workspaceRoot, convention.projectDir) });
  }
  return directories;
}

/** Every custom agent this workspace can offer.
 *
 * A name defined both in the project and for the user is offered once,
 * with the project's definition winning — it is the one its own CLI would
 * use.
 *
 * A definition whose file name a configuration could not name comes
 * back carrying `refused` rather than being left out. Dropping it
 * silently would leave the person who wrote the file with a directory
 * listing and no explanation; a surface offering it as a choice would
 * hand them a save that is then refused. */
export async function findCustomAgents(workspaceRoot: string, homeDir?: string): Promise<CustomAgent[]> {
  const byKey = new Map<string, CustomAgent>();
  for (const convention of CONVENTIONS) {
    // User level first, so the project's entry overwrites it below.
    if (convention.userDir !== undefined && homeDir !== undefined) {
      for (const agent of await readDirectory(path.join(homeDir, convention.userDir), convention)) {
        byKey.set(`${agent.family}/${agent.name}`, agent);
      }
    }
    for (const agent of await readDirectory(path.join(workspaceRoot, convention.projectDir), convention)) {
      byKey.set(`${agent.family}/${agent.name}`, agent);
    }
  }
  return [...byKey.values()].sort((left, right) =>
    left.family.localeCompare(right.family) || left.name.localeCompare(right.name));
}
