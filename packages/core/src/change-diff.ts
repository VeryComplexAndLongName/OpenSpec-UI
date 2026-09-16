// What a change has changed and not yet committed, as git reports it
// (a-screen-says-what-it-is-doing). The standalone shell's Diff Preview shows
// this; before it, that tab rendered a hard-coded two-line sample.
//
// A plain `git diff` is not enough. It shows unstaged edits only, so a
// change's new files — most of a new change — and anything staged would be
// missing, and the tab would call a change full of work "nothing
// uncommitted". This reads the directory against HEAD and adds the untracked
// files as added files.

import { readFile } from "node:fs/promises";
import path from "node:path";
import simpleGit from "simple-git";
import { discoverOpenSpecWorkspace } from "./workbench.js";

/** How much diff text one answer carries. A change whose `tasks.md` was
 * rewritten runs to a few hundred lines; this is several times that. */
export const CHANGE_DIFF_MAX_BYTES = 200_000;

/** Git's own empty tree, the base before a repository's first commit. */
const EMPTY_TREE = "4b825dc642cb6eb9a060e54bf8d69288fbee4904";

export type ChangeDiffResult =
  | {
    kind: "diff";
    /** Unified diff text; empty when the change has nothing uncommitted. */
    diff: string;
    /** Repository-relative paths, sorted. */
    files: string[];
    /** Whether `diff` was cut to `maxBytes`, at a line boundary. */
    truncated: boolean;
    maxBytes: number;
  }
  | { kind: "not-active"; message: string }
  | { kind: "not-a-repository"; message: string };

export async function readChangeDiff(
  workspaceRoot: string,
  changeName: string,
  options: { maxBytes?: number } = {},
): Promise<ChangeDiffResult> {
  const maxBytes = options.maxBytes ?? CHANGE_DIFF_MAX_BYTES;

  // Only a name the workspace lists is ever joined onto a path, so a name
  // carrying `..` never reaches git.
  const workspace = await discoverOpenSpecWorkspace(workspaceRoot);
  if (!workspace.changes.some((change) => change.name === changeName)) {
    return { kind: "not-active", message: `"${changeName}" is not an active change of this workspace.` };
  }

  const git = simpleGit(workspaceRoot);
  const isRepository = await git.checkIsRepo().catch(() => false);
  if (!isRepository) {
    return {
      kind: "not-a-repository",
      message: "This workspace is not a git repository, so there is no diff to show.",
    };
  }

  const pathspec = `openspec/changes/${changeName}`;
  // `--verify --quiet` prints nothing and exits 1 for a missing HEAD, which
  // the client does not reject on: the output decides.
  const head = (await git.raw(["rev-parse", "--verify", "--quiet", "HEAD"]).catch(() => "")).trim();
  const base = head.length > 0 ? "HEAD" : EMPTY_TREE;

  const tracked = await git.raw(["diff", base, "--", pathspec]);
  const trackedFiles = lines(await git.raw(["diff", "--name-only", base, "--", pathspec]));
  const untrackedFiles = lines(await git.raw(["ls-files", "--others", "--exclude-standard", "--full-name", "--", pathspec]));

  const topLevel = (await git.raw(["rev-parse", "--show-toplevel"])).trim();
  const added: string[] = [];
  for (const file of untrackedFiles) {
    added.push(addedFileDiff(file, await readFile(path.join(topLevel, ...file.split("/")))));
  }

  const whole = [tracked, ...added].filter((part) => part.length > 0).map(endWithNewline).join("");
  const { text, truncated } = cutToWholeLines(whole, maxBytes);
  const files = [...new Set([...trackedFiles, ...untrackedFiles])].sort((left, right) => left.localeCompare(right));
  return { kind: "diff", diff: text, files, truncated, maxBytes };
}

function lines(output: string): string[] {
  return output.split(/\r?\n/u).map((line) => line.trim()).filter((line) => line.length > 0);
}

function endWithNewline(text: string): string {
  return text.endsWith("\n") ? text : `${text}\n`;
}

/** An untracked file as git would show it once added. */
function addedFileDiff(file: string, content: Buffer): string {
  const header = `diff --git a/${file} b/${file}\nnew file mode 100644\n`;
  if (content.includes(0)) return `${header}Binary files /dev/null and b/${file} differ\n`;
  const text = content.toString("utf8");
  if (text.length === 0) return header;
  const body = text.split(/\r?\n/u);
  const endsWithNewline = body.at(-1) === "";
  if (endsWithNewline) body.pop();
  const hunk = body.map((line) => `+${line}`).join("\n");
  return `${header}--- /dev/null\n+++ b/${file}\n@@ -0,0 +1,${body.length} @@\n${hunk}\n${endsWithNewline ? "" : "\\ No newline at end of file\n"}`;
}

/** At most `maxBytes` of UTF-8, ending at the last whole line inside it. */
function cutToWholeLines(text: string, maxBytes: number): { text: string; truncated: boolean } {
  const bytes = Buffer.from(text, "utf8");
  if (bytes.length <= maxBytes) return { text, truncated: false };
  const head = bytes.subarray(0, maxBytes).toString("utf8");
  const lastNewline = head.lastIndexOf("\n");
  return { text: lastNewline === -1 ? "" : head.slice(0, lastNewline + 1), truncated: true };
}
