// How work is done in a repository, told to every agent that works in it
// (agents-are-told-how-work-is-done-here, ADR 0043).
//
// An agent started outside this product - Claude Code, Copilot, Codex in
// a person's own terminal - reads CLAUDE.md or AGENTS.md and nothing of
// this product's configuration. Told nothing, it made each new change in
// the checkout it was started in, on whatever branch that had checked out.
// These rules are the one place it learns where a change is worked and who
// does which stage.
//
// A section of its own, between its own markers, so it lives beside the
// project-type guidelines repo-bootstrap.ts writes and beside whatever a
// person wrote: replaced in place where it is, appended to the end of a
// file of somebody else's only where the person said so.

import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

import { GUIDELINES_SECTION_START, WORKFLOW_SECTION_END, WORKFLOW_SECTION_START } from "./managed-sections.js";

export { WORKFLOW_SECTION_END, WORKFLOW_SECTION_START };

/** The files the rules go into: the ones the agents this product runs
 * read on their own. */
export const WORKFLOW_RULE_FILES = ["CLAUDE.md", "AGENTS.md"] as const;
export type WorkflowRuleFile = (typeof WORKFLOW_RULE_FILES)[number];

/** - `created`: the file did not exist.
 * - `updated`: the section was there, and now reads as it should.
 * - `unchanged`: the section was there, already as it should.
 * - `appended`: the file was somebody else's, and the section went to its end.
 * - `skipped-foreign`: the file was somebody else's, and nobody said to add to it. */
export type WorkflowRulesStatus = "created" | "updated" | "unchanged" | "appended" | "skipped-foreign";

export type WorkflowRulesResult = Record<WorkflowRuleFile, WorkflowRulesStatus>;

/** The rules, for a repository of this name. The worktree root is told as
 * the rule it is (ADR 0027), not as a path: the file is committed, and the
 * root differs from machine to machine. */
export function renderWorkflowRules(repositoryName: string, defaultBranch = "main"): string {
  const base = `origin/${defaultBranch}`;
  return [
    WORKFLOW_SECTION_START,
    "## How work is done in this repository",
    "",
    "Written by OpenSpec Workbench; it holds for every agent working here, however it was started.",
    "",
    "### Every change in a working directory of its own",
    "",
    "- Do not create an OpenSpec change, or edit one, in this checkout or on the branch it has checked out.",
    `- Each change is worked in a git worktree of its own, on a branch named after the change, cut from \`${base}\` as the server has it now.`,
    `  Its place is \`<worktree root>/${repositoryName}/<change-id>\`. The worktree root is \`OPENSPEC_UI_WORKTREE_ROOT\` where that is set, else \`worktreeRoot\` in \`~/.openspec-ui/settings.json\`, else \`.worktrees\` beside this repository - so by default \`../.worktrees/${repositoryName}/<change-id>\`.`,
    `- A change is cut from what the server has, so \`${base}\` must hold this repository's OpenSpec setup (\`openspec/\`, these rules). Where it does not yet, do that first, here in this checkout and only that: commit the setup - nothing of any change - to \`${defaultBranch}\`, push it, and go on. Stop and say so only if the push is refused.`,
    "- Make it before writing anything for the change:",
    "",
    "  ```",
    "  git fetch origin",
    `  openspec-ui-cli create worktree <change-id> --base ${base}`,
    "  ```",
    "",
    "  or, without the OpenSpec Workbench CLI:",
    "",
    "  ```",
    "  git fetch origin",
    `  git worktree add ../.worktrees/${repositoryName}/<change-id> -b <change-id> ${base}`,
    "  ```",
    "",
    "  Then run `openspec new change <change-id>` there, and do everything else for the change - its planning artifacts, its code, its commits and pushes - in that directory.",
    "- One change, one branch, one pull request, each named after the change.",
    "",
    "### Who does which stage",
    "",
    "- Which agent proposes, reviews, applies and verifies a change is set in `openspec/agent-harness.json` (`stepAgents`) and, for one change, in `openspec/changes/<change-id>/harness.json`. Read it before starting a stage.",
    "- Where a stage is named for another agent, do not do it yourself: say which agent it belongs to, and stop.",
    WORKFLOW_SECTION_END,
  ].join("\n");
}

async function readIfThere(file: string): Promise<string | undefined> {
  try {
    return await readFile(file, "utf8");
  } catch {
    return undefined;
  }
}

/** A file this product wrote, with its project-type guidelines first:
 * the rules go after them without asking anybody. */
function isOurs(existing: string): boolean {
  return existing.startsWith(GUIDELINES_SECTION_START);
}

/** The files that exist without the section and are somebody else's:
 * adding the rules to them changes a file a person wrote, so a host asks
 * first. */
export async function workflowRulesNeedConsent(workspaceRoot: string): Promise<WorkflowRuleFile[]> {
  const foreign: WorkflowRuleFile[] = [];
  for (const name of WORKFLOW_RULE_FILES) {
    const existing = await readIfThere(path.join(workspaceRoot, name));
    if (existing !== undefined && !existing.includes(WORKFLOW_SECTION_START) && !isOurs(existing)) foreign.push(name);
  }
  return foreign;
}

function withSection(existing: string, section: string): string | undefined {
  const start = existing.indexOf(WORKFLOW_SECTION_START);
  if (start === -1) return undefined;
  const end = existing.indexOf(WORKFLOW_SECTION_END, start);
  if (end === -1) return undefined;
  return existing.slice(0, start) + section + existing.slice(end + WORKFLOW_SECTION_END.length);
}

/** Writes the rules into CLAUDE.md and AGENTS.md: creates a file that is
 * not there, rewrites the section where it is, and appends it to a file
 * without it only where `appendToForeign` says so. Nothing else of a file
 * is touched. */
export async function writeWorkflowRules(
  workspaceRoot: string,
  options: { appendToForeign: boolean; defaultBranch?: string },
): Promise<WorkflowRulesResult> {
  const section = renderWorkflowRules(path.basename(path.resolve(workspaceRoot)), options.defaultBranch);
  const result = {} as WorkflowRulesResult;
  for (const name of WORKFLOW_RULE_FILES) {
    const file = path.join(workspaceRoot, name);
    const existing = await readIfThere(file);
    if (existing === undefined) {
      await mkdir(path.dirname(file), { recursive: true });
      await writeFile(file, `${section}\n`, "utf8");
      result[name] = "created";
      continue;
    }
    const replaced = withSection(existing, section);
    if (replaced !== undefined) {
      if (replaced === existing) {
        result[name] = "unchanged";
      } else {
        await writeFile(file, replaced, "utf8");
        result[name] = "updated";
      }
      continue;
    }
    const ours = isOurs(existing);
    if (!ours && !options.appendToForeign) {
      result[name] = "skipped-foreign";
      continue;
    }
    const separator = existing.length === 0 || existing.endsWith("\n\n") ? "" : existing.endsWith("\n") ? "\n" : "\n\n";
    await writeFile(file, `${existing}${separator}${section}\n`, "utf8");
    result[name] = ours ? "updated" : "appended";
  }
  return result;
}
