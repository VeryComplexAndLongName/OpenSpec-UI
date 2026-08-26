// Best-effort presence check for whether a workspace has adopted
// Changesets (`.changeset/config.json`) and, if so, whether any changeset
// file is currently pending. A host adapter uses this to decide whether to
// show an archive-time reminder — this module only reports facts, it never
// prompts or writes anything itself (see openspec/changes/
// add-changeset-archive-reminder/design.md).

import { access, readdir } from "node:fs/promises";
import path from "node:path";

export interface ChangesetReminderStatus {
  changesetsAdopted: boolean;
  pendingChangesetCount: number;
}

const README_NAMES = new Set(["readme.md"]);

/** Returns whether `cwd` has adopted Changesets (a `.changeset/config.json`
 * file exists) and, if so, how many pending `.changeset/*.md` changeset
 * files exist (excluding `.changeset/README.md`). Never throws — a missing
 * or unreadable `.changeset` directory is reported as "not adopted". */
export async function checkChangesetReminder(cwd: string): Promise<ChangesetReminderStatus> {
  const changesetDir = path.join(cwd, ".changeset");
  try {
    await access(path.join(changesetDir, "config.json"));
  } catch {
    return { changesetsAdopted: false, pendingChangesetCount: 0 };
  }

  let entries: string[] = [];
  try {
    entries = await readdir(changesetDir);
  } catch {
    entries = [];
  }
  const pendingChangesetCount = entries.filter(
    (name) => name.toLowerCase().endsWith(".md") && !README_NAMES.has(name.toLowerCase()),
  ).length;

  return { changesetsAdopted: true, pendingChangesetCount };
}
