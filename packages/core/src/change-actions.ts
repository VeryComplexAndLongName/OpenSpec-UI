// Every action on a change, in one list (ADR 0044, a-change-is-acted-on-from-
// its-card). A change's card offers these, in both hosts, and the Changes
// tree offers the same ones from the same list: neither has an action the
// other lacks. Where a change is worked - this checkout or its own worktree -
// decides where an action runs, never whether it is offered; what a change
// is doing decides whether an action can run now, and says why not.
//
// A leaf beside action-vocabulary.ts, so `webui` reads it as the extension
// does.

import { actionCommandId, actionVerb, type ActionGroup } from "./action-vocabulary.js";

export type ChangeActionId =
  | "runChange"
  | "sendMessage"
  | "stopRun"
  | "validateChange"
  | "showDiff"
  | "showTimeline"
  | "showAncestry"
  | "showCost"
  | "showGraph"
  | "explainChangeHarness"
  | "recommendChangeHarness"
  | "openWorktree"
  | "openChangeCopy"
  | "commitChange"
  | "configureChangeHarness"
  | "addRelation"
  | "removeRelation"
  | "archiveChange"
  | "rollbackChange"
  | "deleteChange";

export interface ChangeAction {
  id: ChangeActionId;
  /** The VS Code command that performs it: `openspec-ui.<id>`. */
  command: string;
  /** Its title, a verb and a noun, with three dots where it asks first. */
  title: string;
  group: ActionGroup;
  /** The codicon it is drawn with, the same as its command's in the
   * extension's manifest. */
  icon: string;
  /** It changes the change, so it runs where the change is worked, and is
   * refused where that directory's records do not check out. */
  writes: boolean;
  /** Asked to be confirmed before it runs: every Danger action is. */
  confirm: boolean;
  /** What it does that cannot be taken back, said where it is confirmed. */
  consequence?: string;
}

function action(id: ChangeActionId, title: string, icon: string, writes: boolean, consequence?: string): ChangeAction {
  const bare = title.endsWith("...") ? title.slice(0, -3) : title;
  const verb = actionVerb(bare.slice(0, bare.indexOf(" ")));
  if (verb === undefined) throw new Error(`change action ${id}: "${title}" has no verb from the list`);
  const command = actionCommandId(verb.verb, bare.slice(bare.indexOf(" ") + 1));
  if (command !== `openspec-ui.${id}`) throw new Error(`change action ${id}: "${title}" names ${command}`);
  return { id, command, title, group: verb.group, icon, writes, confirm: verb.group === "danger", ...(consequence !== undefined ? { consequence } : {}) };
}

/** Every action on an active change, in the order the surfaces show them:
 * by group, then as listed. */
export const CHANGE_ACTIONS: readonly ChangeAction[] = [
  action("runChange", "Run Change...", "play", true),
  action("sendMessage", "Send Message...", "comment", false),
  action("stopRun", "Stop Run...", "debug-stop", false),
  action("validateChange", "Validate Change", "checklist", false),
  action("showDiff", "Show Diff", "diff", false),
  action("showTimeline", "Show Timeline", "history", false),
  action("showAncestry", "Show Ancestry", "type-hierarchy-super", false),
  action("showCost", "Show Cost", "credit-card", false),
  action("showGraph", "Show Graph", "graph", false),
  action("explainChangeHarness", "Explain Change Harness", "info", false),
  action("recommendChangeHarness", "Recommend Change Harness", "lightbulb", false),
  action("openWorktree", "Open Worktree", "folder-opened", false),
  action("openChangeCopy", "Open Change Copy...", "files", false),
  // Everything its worktree holds, committed on its branch and pushed
  // (a-change-is-committed-where-it-is-made).
  action("commitChange", "Commit Change", "git-commit", true),
  action("configureChangeHarness", "Configure Change Harness", "gear", true),
  action("addRelation", "Add Relation...", "link", true),
  action("removeRelation", "Remove Relation...", "debug-disconnect", true),
  action("archiveChange", "Archive Change", "archive", true,
    "Its specs are merged into openspec/specs, and the change moves to the archive."),
  action("rollbackChange", "Rollback Change", "debug-reverse-continue", true,
    "The files its runs changed are put back as they were before the runs."),
  action("deleteChange", "Delete Change", "trash", true,
    "Its folder is deleted, with every document in it. This cannot be undone."),
];

export function changeAction(id: string): ChangeAction | undefined {
  return CHANGE_ACTIONS.find((entry) => entry.id === id);
}

export function isChangeActionId(id: unknown): id is ChangeActionId {
  return typeof id === "string" && changeAction(id) !== undefined;
}

/** What decides whether an action can run now. */
export interface ChangeActionFacts {
  /** Where the change is worked: this checkout, its own working directory,
   * or a directory whose records do not check out. */
  where: "checkout" | "worktree" | "unverified";
  /** A run of the change is going, here or elsewhere. */
  running: boolean;
  /** Its tasks still open, where they were read. */
  openTasks?: number;
  /** Its branch is not on the server as it is here: never pushed, or at
   * another commit (a-change-is-committed-where-it-is-made). */
  notOnServer?: boolean;
}

export interface ChangeActionState {
  action: ChangeAction;
  enabled: boolean;
  /** Why it cannot run now, in the words a disabled control says. */
  reason?: string;
}

const NOT_RUNNING = "No run of this change is going.";
const RUNNING = "A run of this change is going: stop it first.";

function reasonAgainst(action: ChangeAction, facts: ChangeActionFacts): string | undefined {
  if (action.writes && facts.where === "unverified") {
    return "The records of the directory it is worked in do not check out: work on it there.";
  }
  switch (action.id) {
    case "runChange":
      return facts.running ? "A run of this change is going." : undefined;
    case "sendMessage":
    case "stopRun":
      return facts.running ? undefined : NOT_RUNNING;
    case "openWorktree":
    case "openChangeCopy":
      return facts.where === "checkout" ? "This change is worked in this checkout." : undefined;
    case "commitChange":
      // Never in the checkout: what is there goes on the default branch
      // (ADR 0043). A run commits as it goes, and two committers in one
      // tree is one too many.
      if (facts.where === "checkout") return "This change is worked in this checkout, not on a branch of its own.";
      return facts.running ? RUNNING : undefined;
    case "archiveChange":
      if (facts.running) return RUNNING;
      return facts.openTasks !== undefined && facts.openTasks > 0
        ? `${facts.openTasks} task(s) are still open.`
        : undefined;
    case "rollbackChange":
    case "deleteChange":
      return facts.running ? RUNNING : undefined;
    default:
      return undefined;
  }
}

/** Every action on a change, each with whether it can run now and why not. */
export function changeActionStates(facts: ChangeActionFacts): ChangeActionState[] {
  return CHANGE_ACTIONS.map((entry) => {
    const reason = reasonAgainst(entry, facts);
    return reason === undefined ? { action: entry, enabled: true } : { action: entry, enabled: false, reason };
  });
}

/** What a host that runs an action elsewhere - the standalone app's server -
 * answers (a-change-is-acted-on-from-its-card): a report to read, what was
 * done, or the relations a person picks from. */
export type ChangeActionAnswer =
  | { kind: "report"; title: string; markdown: string }
  | { kind: "done"; message: string }
  | { kind: "relations"; keys: readonly string[]; changes: string[]; stated: Array<{ key: string; id: string }> };

/** What a person gave an action that asks first. */
export interface ChangeActionInput {
  relation?: { key: string; id: string };
  message?: { kind: "note" | "ask"; words: string };
  stop?: { afterTask?: string; reason: string };
}

/** The actions the standalone app does in the page itself, without its
 * server: Start is the card's control, the change's harness opens in the
 * page, and the change's copy opens as its tasks page. */
export const PAGE_CHANGE_ACTIONS: ReadonlySet<ChangeActionId> = new Set(["runChange", "configureChangeHarness", "openChangeCopy"]);