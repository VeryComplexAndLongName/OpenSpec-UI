// Every action the product offers is a verb and a noun (ADR 0045,
// every-action-is-a-verb-and-a-noun): one list of verbs, each with the group
// and danger every surface shows it with, and one list of nouns. A
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
  { verb: "Run", group: "run" },
  { verb: "Continue", group: "run" },
  { verb: "Update", group: "run" },
  { verb: "Reopen", group: "run" },
  { verb: "Stop", group: "run" },
  { verb: "Send", group: "run" },
  { verb: "Finish", group: "run" },
  { verb: "Answer", group: "respond" },
  { verb: "Allow", group: "respond" },
  { verb: "Deny", group: "respond" },
  { verb: "Confirm", group: "respond" },
  { verb: "Show", group: "inspect" },
  { verb: "Open", group: "inspect" },
  { verb: "Find", group: "inspect" },
  { verb: "Explain", group: "inspect" },
  { verb: "Recommend", group: "inspect" },
  { verb: "Validate", group: "inspect" },
  { verb: "Diagnose", group: "inspect" },
  { verb: "Filter", group: "arrange" },
  { verb: "Clear", group: "arrange" },
  { verb: "Hide", group: "arrange" },
  { verb: "Refresh", group: "arrange" },
  { verb: "Copy", group: "arrange" },
  { verb: "Configure", group: "set-up" },
  { verb: "Set", group: "set-up" },
  { verb: "Initialize", group: "set-up" },
  { verb: "Write", group: "set-up" },
  { verb: "Generate", group: "set-up" },
  { verb: "Create", group: "set-up" },
  { verb: "Edit", group: "set-up" },
  { verb: "Insert", group: "set-up" },
  { verb: "Add", group: "set-up" },
  { verb: "Remove", group: "set-up" },
  { verb: "Join", group: "set-up" },
  { verb: "Restore", group: "set-up" },
  { verb: "Commit", group: "set-up" },
  { verb: "Complete", group: "set-up" },
  { verb: "Move", group: "set-up" },
  { verb: "Archive", group: "danger" },
  { verb: "Rollback", group: "danger" },
  { verb: "Delete", group: "danger" },
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
