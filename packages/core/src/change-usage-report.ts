// Historical usage is resolved in core, independently of the active task
// resolver. The same repository audit boundary is used by Harness budgets.
import { readdir, stat } from "node:fs/promises";
import path from "node:path";
import { isRunEntry } from "./audit-runs.js";
import { isValidChangeName } from "./change-name.js";
import { createGitWrapper, type GitWrapper } from "./git.js";
import { readRepositoryAuditEntries, repositoryWorkspaceRoots } from "./repository-audit.js";
import { buildUsageReport } from "./usage-report.js";

const ARCHIVE_PREFIX = /^\d{4}-\d{2}-\d{2}-/u;

export class ChangeUsageRefusal extends Error {}

async function directoryExists(directory: string): Promise<boolean> {
  try {
    return (await stat(directory)).isDirectory();
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return false;
    throw error;
  }
}

async function archiveNames(root: string): Promise<string[]> {
  try {
    return (await readdir(path.join(root, "openspec", "changes", "archive"), { withFileTypes: true }))
      .filter((entry) => entry.isDirectory()).map((entry) => entry.name);
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return [];
    throw error;
  }
}

/** Read only retained repository logs. An archived change's old active path
 * is still its identity, even if the writing worktree no longer exists. */
export async function readChangeUsageReport(options: {
  workspaceRoot: string;
  changeName: string;
  git?: Pick<GitWrapper, "worktreeList">;
}) {
  if (!isValidChangeName(options.changeName) || options.changeName === "archive") {
    throw new ChangeUsageRefusal(`Invalid change name: ${options.changeName}`);
  }
  const git = options.git ?? createGitWrapper({ cwd: options.workspaceRoot });
  const roots = await repositoryWorkspaceRoots({ git, workspaceRoot: options.workspaceRoot });
  const archived = new Set((await Promise.all(roots.map(archiveNames))).flat());
  const exactArchive = archived.has(options.changeName) ? options.changeName : undefined;
  const changeName = exactArchive?.replace(ARCHIVE_PREFIX, "") ?? options.changeName;
  const matches = [...archived].filter((name) => name.replace(ARCHIVE_PREFIX, "") === changeName).sort();
  if (matches.length > 1) {
    throw new ChangeUsageRefusal(`Ambiguous change ${changeName}: ${matches.join(", ")}. Historical active paths cannot distinguish reused names.`);
  }
  const archiveName = matches[0];
  const active = await Promise.all(roots.map((root) => directoryExists(path.join(root, "openspec", "changes", changeName))));
  if (!archiveName && !active.some(Boolean)) throw new ChangeUsageRefusal(`Unknown change ${options.changeName}; no active or archived change exists.`);

  const entries = await readRepositoryAuditEntries({ git, workspaceRoot: options.workspaceRoot });
  const belongs = (directory: string) => {
    const normalized = directory.replaceAll("\\", "/").replace(/\/+$/u, "");
    const match = /(?:^|\/)openspec\/changes\/(?:archive\/)?([^/]+)$/u.exec(normalized);
    return match !== null && (match[1] === changeName || match[1] === archiveName);
  };
  const anchors = entries.filter((entry) => entry.changeDir !== undefined && belongs(entry.changeDir));
  const runIds = new Set(anchors.map((entry) => entry.runId));
  const invocationIds = new Set(anchors.flatMap((entry) => entry.invocationId ? [entry.invocationId] : []));
  const selected = entries.filter((entry) => entry.changeDir !== undefined
    ? belongs(entry.changeDir)
    : entry.invocationId ? invocationIds.has(entry.invocationId) : runIds.has(entry.runId));
  return {
    changeName,
    ...(archiveName !== undefined ? { archiveName } : {}),
    recordedRunCount: new Set(selected.filter(isRunEntry).map((entry) => entry.runId)).size,
    ...buildUsageReport(selected),
  };
}
