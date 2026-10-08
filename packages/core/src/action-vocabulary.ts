// Every action the product offers is a verb and a noun (ADR 0045,
// every-action-is-a-verb-and-a-noun): one list of verbs, each with the group,
// icon and danger every surface shows it with, and one list of nouns. A
// command's title, a CLI subcommand and a card's control are a pair from
// these lists, and the tests that hold each surface ask this module.
//
// A leaf with no imports, so `webui` reads it as the extension does.

/** The groups an action belongs to, by its verb, in the order every surface
 * shows them. */
export type ActionGroup = "run" | "respond" | "inspect" | "arrange" | "set-up" | "danger";

export interface ActionVerb {
  verb: string;
  group: ActionGroup;
  /** A codicon name: the same icon wherever the verb is shown. */
  icon: string;
}

export const ACTION_GROUPS: ReadonlyArray<{ group: ActionGroup; label: string; color: string }> = [
  { group: "run", label: "Run", color: "charts.blue" },
  { group: "respond", label: "Respond", color: "charts.green" },
  { group: "inspect", label: "Inspect", color: "charts.purple" },
  { group: "arrange", label: "Arrange", color: "descriptionForeground" },
  { group: "set-up", label: "Set up", color: "charts.yellow" },
  { group: "danger", label: "Danger", color: "errorForeground" },
];

export const ACTION_VERBS: readonly ActionVerb[] = [
  { verb: "Run", group: "run", icon: "play" },
  { verb: "Continue", group: "run", icon: "debug-continue" },
  { verb: "Update", group: "run", icon: "sync" },
  { verb: "Reopen", group: "run", icon: "issue-reopened" },
  { verb: "Stop", group: "run", icon: "debug-stop" },
  { verb: "Send", group: "run", icon: "comment" },
  { verb: "Finish", group: "run", icon: "check-all" },
  { verb: "Answer", group: "respond", icon: "reply" },
  { verb: "Allow", group: "respond", icon: "check" },
  { verb: "Deny", group: "respond", icon: "close" },
  { verb: "Confirm", group: "respond", icon: "pass" },
  { verb: "Show", group: "inspect", icon: "eye" },
  { verb: "Open", group: "inspect", icon: "go-to-file" },
  { verb: "Find", group: "inspect", icon: "search" },
  { verb: "Explain", group: "inspect", icon: "info" },
  { verb: "Recommend", group: "inspect", icon: "lightbulb" },
  { verb: "Validate", group: "inspect", icon: "checklist" },
  { verb: "Diagnose", group: "inspect", icon: "pulse" },
  { verb: "Filter", group: "arrange", icon: "filter" },
  { verb: "Clear", group: "arrange", icon: "clear-all" },
  { verb: "Hide", group: "arrange", icon: "eye-closed" },
  { verb: "Refresh", group: "arrange", icon: "refresh" },
  { verb: "Copy", group: "arrange", icon: "copy" },
  { verb: "Configure", group: "set-up", icon: "settings-gear" },
  { verb: "Set", group: "set-up", icon: "symbol-property" },
  { verb: "Initialize", group: "set-up", icon: "rocket" },
  { verb: "Write", group: "set-up", icon: "pencil" },
  { verb: "Generate", group: "set-up", icon: "sparkle" },
  { verb: "Create", group: "set-up", icon: "new-file" },
  { verb: "Edit", group: "set-up", icon: "edit" },
  { verb: "Insert", group: "set-up", icon: "insert" },
  { verb: "Add", group: "set-up", icon: "add" },
  { verb: "Remove", group: "set-up", icon: "remove" },
  { verb: "Join", group: "set-up", icon: "person-add" },
  { verb: "Restore", group: "set-up", icon: "discard" },
  { verb: "Commit", group: "set-up", icon: "git-commit" },
  { verb: "Complete", group: "set-up", icon: "check" },
  { verb: "Move", group: "set-up", icon: "arrow-right" },
  { verb: "Archive", group: "danger", icon: "archive" },
  { verb: "Rollback", group: "danger", icon: "debug-step-back" },
  { verb: "Delete", group: "danger", icon: "trash" },
];

/** What an action acts on. A noun of two words is one noun. */
export const ACTION_NOUNS: readonly string[] = [
  "Change", "Change Harness", "Workspace Harness", "Change Copy", "Plan", "Run", "Item", "Task", "Tasks",
  "Question", "Questions", "Permission", "Message", "Relation", "Relations", "Diff", "Timeline",
  "Comparison", "Cost", "Ancestry", "Details", "Status", "Readiness", "Advice", "History", "Stages",
  "Graph", "Worktree", "Worktrees", "Leftover", "Template", "Specs", "Report", "Rules", "Instructions",
  "Scoped Instructions", "Dependabot", "LLM Key", "Key", "Team", "People", "Owner", "Implementer",
  "Presence", "Lock", "Lease", "Checks", "Manifest", "Workspace", "Pipeline", "Dashboard", "Views",
  "Archive", "Archive Filter", "Specs Filter", "Graph Filter", "Process", "Implementation", "Typecheck",
  "Tests", "Lint", "CLI View", "Changes",
];

/** The verb an action is named by. */
export function actionVerb(verb: string): ActionVerb | undefined {
  return ACTION_VERBS.find((entry) => entry.verb === verb);
}

/** A title read as its verb and noun, or `undefined` for one that is not a
 * pair from the lists. Three dots at its end - an action that asks first -
 * are not part of the noun. */
export function readActionTitle(title: string): { verb: ActionVerb; noun: string; asksFirst: boolean } | undefined {
  const asksFirst = title.endsWith("...");
  const bare = asksFirst ? title.slice(0, -3) : title;
  const space = bare.indexOf(" ");
  if (space === -1) return undefined;
  const verb = actionVerb(bare.slice(0, space));
  const noun = bare.slice(space + 1);
  if (verb === undefined || !ACTION_NOUNS.includes(noun)) return undefined;
  return { verb, noun, asksFirst };
}

/** The VS Code command id a pair is given: `openspec-ui.<verb><Noun>`. */
export function actionCommandId(verb: string, noun: string): string {
  const words = noun.split(" ");
  const camel = words.map((word) => (word.toUpperCase() === word && word.length > 1 ? word[0] + word.slice(1).toLowerCase() : word)).join("");
  return `openspec-ui.${verb[0]!.toLowerCase()}${verb.slice(1)}${camel}`;
}

/** The CLI form of a pair: both words in lower case, a noun of two words
 * joined by a hyphen (`show questions`, `validate changes`). */
export function actionCliForm(verb: string, noun: string): string {
  return `${verb.toLowerCase()} ${noun.toLowerCase().replace(/ /gu, "-")}`;
}
