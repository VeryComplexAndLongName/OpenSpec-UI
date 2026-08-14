import { readFile } from "node:fs/promises";
import { discoverOpenSpecWorkspace } from "./workbench.js";

// See openspec/changes/archive-tasks-as-template/design.md, "Core: one
// read-only template function, not a generic archive-file-read API".
// `discoverOpenSpecWorkspace`'s `archivedChanges` is the allowlist for what
// may be read here — `changeName` is never used to build a path directly,
// so a crafted name (e.g. path-traversal-shaped) cannot escape the archive.

export class ArchivedChangeNotFoundError extends Error {
  constructor(changeName: string) {
    super(`Archived change not found: ${changeName}`);
    this.name = "ArchivedChangeNotFoundError";
  }
}

function resetCheckboxes(markdown: string): string {
  return markdown.replace(/-\s\[[xX]\]/g, "- [ ]");
}

/** Reads an archived change's `tasks.md` and returns it as a template:
 * checkbox items reset to unchecked, headings and task text preserved
 * verbatim. Throws `ArchivedChangeNotFoundError` if `changeName` is not an
 * archived change in `workspaceRoot`. */
export async function readArchivedChangeTasksTemplate(
  workspaceRoot: string,
  changeName: string,
): Promise<string> {
  const workspace = await discoverOpenSpecWorkspace(workspaceRoot);
  const archivedChange = workspace.archivedChanges.find((change) => change.name === changeName);
  if (!archivedChange) throw new ArchivedChangeNotFoundError(changeName);

  const tasksArtifact = archivedChange.artifacts.find((artifact) => artifact.id === "tasks");
  if (!tasksArtifact || !tasksArtifact.exists) return "";

  const content = await readFile(tasksArtifact.path, "utf8");
  return resetCheckboxes(content);
}
