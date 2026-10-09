// The CLI's subcommands are a verb and a noun (ADR 0045,
// every-action-is-a-verb-and-a-noun): `openspec-ui-cli answer question …`,
// `openspec-ui-cli diagnose workspace`. Each pair is carried to the handler
// that does the work, which keeps its own internal name; a subcommand by its
// former name is refused, naming the pair that replaced it, rather than kept
// beside it.

import { readActionTitle } from "@openspec-ui/core";

interface Route {
  verb: string;
  noun: string;
  /** The handler's internal name and the positionals it starts with. */
  handler: readonly string[];
}

/** Every subcommand, as a pair, and the handler it runs. */
export const SUBCOMMANDS: readonly Route[] = [
  { verb: "validate", noun: "changes", handler: ["validate"] },
  { verb: "run", noun: "change", handler: ["run"] },
  { verb: "update", noun: "plan", handler: ["update"] },
  { verb: "run", noun: "checks", handler: ["check"] },
  { verb: "show", noun: "readiness", handler: ["ready"] },
  { verb: "diagnose", noun: "workspace", handler: ["doctor"] },
  { verb: "show", noun: "advice", handler: ["advise"] },
  { verb: "show", noun: "lease", handler: ["lease"] },
  { verb: "remove", noun: "lease", handler: ["lease", "release"] },
  { verb: "show", noun: "status", handler: ["status"] },
  { verb: "set", noun: "presence", handler: ["present"] },
  { verb: "set", noun: "lock", handler: ["claim"] },
  { verb: "stop", noun: "run", handler: ["stop"] },
  { verb: "confirm", noun: "key", handler: ["enrol"] },
  { verb: "join", noun: "team", handler: ["join"] },
  { verb: "show", noun: "people", handler: ["people"] },
  { verb: "show", noun: "history", handler: ["history"] },
  { verb: "show", noun: "stages", handler: ["stages"] },
  { verb: "set", noun: "owner", handler: ["owner"] },
  { verb: "set", noun: "implementer", handler: ["implementer"] },
  { verb: "reopen", noun: "change", handler: ["send-back"] },
  { verb: "complete", noun: "task", handler: ["task", "done"] },
  { verb: "reopen", noun: "task", handler: ["task", "reopen"] },
  { verb: "commit", noun: "tasks", handler: ["task", "commit"] },
  { verb: "show", noun: "questions", handler: ["answer"] },
  { verb: "answer", noun: "question", handler: ["answer"] },
  { verb: "create", noun: "worktree", handler: ["worktree", "add"] },
  { verb: "show", noun: "worktrees", handler: ["worktree", "list"] },
  { verb: "move", noun: "worktree", handler: ["worktree", "move"] },
  { verb: "delete", noun: "worktree", handler: ["worktree", "remove"] },
  { verb: "show", noun: "graph", handler: ["change-graph"] },
  { verb: "write", noun: "manifest", handler: ["release-manifest"] },
];

/** What each former subcommand became, for the refusal that says so. */
const RENAMED: Readonly<Record<string, string>> = {
  validate: "validate changes",
  run: "run change",
  update: "update plan",
  check: "run checks",
  ready: "show readiness",
  doctor: "diagnose workspace",
  advise: "show advice",
  lease: "show lease, or remove lease",
  status: "show status",
  present: "set presence",
  claim: "set lock",
  stop: "stop run",
  enrol: "confirm key",
  join: "join team",
  people: "show people",
  history: "show history",
  stages: "show stages",
  owner: "set owner",
  implementer: "set implementer",
  "send-back": "reopen change",
  task: "complete task, reopen task or commit tasks",
  answer: "show questions, or answer question",
  worktree: "create worktree, show worktrees, move worktree or delete worktree",
  "change-graph": "show graph",
  "release-manifest": "write manifest",
};

export type RoutedSubcommand =
  | { kind: "handler"; positionals: string[] }
  | { kind: "renamed"; former: string; replacement: string }
  | { kind: "unknown" };

/** The handler a command line's positionals name, by the pair they start
 * with; a former subcommand's name, and what replaced it; or neither. */
export function routeSubcommand(positionals: readonly string[]): RoutedSubcommand {
  const [verb, noun, ...rest] = positionals;
  const route = SUBCOMMANDS.find((entry) => entry.verb === verb && entry.noun === noun);
  if (route !== undefined) return { kind: "handler", positionals: [...route.handler, ...rest] };
  if (verb !== undefined && RENAMED[verb] !== undefined) return { kind: "renamed", former: verb, replacement: RENAMED[verb]! };
  return { kind: "unknown" };
}

/** The pair a handler is reached by, for a message that names the
 * subcommand a person typed rather than the handler's internal name. */
export function publicNameOf(...handler: string[]): string {
  const route = SUBCOMMANDS.find((entry) => entry.handler.length === handler.length && entry.handler.every((part, index) => part === handler[index]))
    ?? SUBCOMMANDS.find((entry) => entry.handler[0] === handler[0]);
  return route === undefined ? handler.join(" ") : `${route.verb} ${route.noun}`;
}

/** Every pair as it is typed, for the usage text and a refusal. */
export function subcommandNames(): string[] {
  return SUBCOMMANDS.map((entry) => `${entry.verb} ${entry.noun}`);
}

/** Whether a pair reads as a verb and a noun from the product's lists. */
export function isVocabularyPair(verb: string, noun: string): boolean {
  const title = `${verb[0]!.toUpperCase()}${verb.slice(1)} ${noun.split("-").map((word) => (word === "llm" || word === "cli" ? word.toUpperCase() : word[0]!.toUpperCase() + word.slice(1))).join(" ")}`;
  return readActionTitle(title) !== undefined;
}
