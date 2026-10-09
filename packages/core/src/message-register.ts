// Every message has an identifier (ADR 0046, every-message-has-an-identifier).
// What the product says to a person - a failure's reason, a refusal, a
// notice - is written once, here, under its identifier, and said by that
// identifier everywhere: `error OSW-RUN-104: "apply" changed no file ...`.
// docs/messages.md is generated from this register (`npm run messages
// --workspace @openspec-ui/core`), and message-register.test.ts holds both.
//
// An identifier is `OSW-<GROUP>-<NNN>`. Within a group the hundreds say when
// a message is said: 0xx before anything runs (an argument, a refusal), 1xx
// while it runs, 2xx as it ends (a limit, an interruption). A number is
// never given twice: a message that goes is marked `retired`, and stays.
//
// A leaf with no imports, so `webui` reads it as the extension and the CLI do.

export type MessageLevel = "error" | "warning" | "info";

export type MessageGroup = "CHG" | "RUN" | "QST" | "PRM" | "HRN" | "AGT" | "TSK" | "VAL" | "ARC" | "GIT" | "WSP" | "KEY" | "NET" | "CLI";

/** The groups, by the nouns of ADR 0045, in the order docs/messages.md
 * lists them. */
export const MESSAGE_GROUPS: ReadonlyArray<{ group: MessageGroup; about: string }> = [
  { group: "CHG", about: "a change: finding, creating, deleting it, where it lives" },
  { group: "RUN", about: "runs, chains, stages, checkpoints, limits" },
  { group: "QST", about: "questions to the operator" },
  { group: "PRM", about: "permission requests" },
  { group: "HRN", about: "harness settings" },
  { group: "AGT", about: "agents and adapters: missing, signed out, failed" },
  { group: "TSK", about: "tasks: ticks, Human-only, delegation" },
  { group: "VAL", about: "validation, the merge gate, checks" },
  { group: "ARC", about: "archiving" },
  { group: "GIT", about: "git, branches, worktrees, push, pull requests" },
  { group: "WSP", about: "the workspace: setup, lease, locks" },
  { group: "KEY", about: "signatures, keys, the team" },
  { group: "NET", about: "network, proxy, the local LLM" },
  { group: "CLI", about: "the CLI's arguments and subcommands" },
];

export interface MessageEntry {
  level: MessageLevel;
  /** The words, with `{name}` where a value goes. */
  text: string;
  /** Why it is said. */
  why: string;
  /** What a person does about it. */
  todo: string;
  /** When and why it stopped being said. Its identifier stays reserved. */
  retired?: string;
}

export const MESSAGES = {
  // CLI: the CLI's arguments and subcommands.
  "OSW-CLI-001": {
    level: "error",
    text: "'{former}' was renamed: use 'openspec-ui-cli {replacement}' (ADR 0045)",
    why: "Every subcommand became a verb and a noun (ADR 0045), and a former name is refused rather than kept as an alias.",
    todo: "Use the subcommand the message names, in the script or habit that typed the former one.",
  },
  "OSW-CLI-002": {
    level: "error",
    text: "unknown command '{command}' (supported: {supported})",
    why: "What was typed is no subcommand, former or current.",
    todo: "Use one of the subcommands listed; `openspec-ui-cli --help` says what each does.",
  },
  "OSW-CLI-003": {
    level: "error",
    text: "{option} requires a value",
    why: "An option that takes a value was the last word typed.",
    todo: "Give the option its value: `--cwd <directory>`, `--change <name>`.",
  },
  "OSW-CLI-004": {
    level: "error",
    text: "--format must be 'json' or 'text'",
    why: "`--format` takes one of two values.",
    todo: "Use `--format json` for a program to read, `--format text` for a person.",
  },
  "OSW-CLI-005": {
    level: "error",
    text: "{subcommand} requires a change name",
    why: "The subcommand acts on one change, and none was named.",
    todo: "Name the change after the subcommand, as its folder under openspec/changes is named.",
  },
  "OSW-CLI-006": {
    level: "error",
    text: "set lock requires a resource name",
    why: "A lock is taken on something named, and nothing was.",
    todo: "Name the resource: `openspec-ui-cli set lock <resource>`.",
  },
  "OSW-CLI-007": {
    level: "error",
    text: "--wait takes a number of seconds",
    why: "`--wait` was given something that is not a number.",
    todo: "Give it a number of seconds: `--wait 30`.",
  },
  "OSW-CLI-008": {
    level: "error",
    text: "join team requires --handle and --name",
    why: "A person joins the team under a handle and a name, and one was missing.",
    todo: "Give both: `openspec-ui-cli join team --handle <handle> --name \"<name>\"`.",
  },
  "OSW-CLI-009": {
    level: "error",
    text: "reopen change requires --stage proposed|planned|in-progress|in-review and --reason <text>",
    why: "A change is sent back to a stage that is named, for a reason that is written down.",
    todo: "Give both the stage and the reason.",
  },
  "OSW-CLI-010": {
    level: "error",
    text: "stop run needs the instance id of the run to ask, as 'openspec-ui-cli show status' prints it",
    why: "A run is asked to stop by its instance id, and none was given.",
    todo: "Run `openspec-ui-cli show status`, and pass the id it prints for the run.",
  },
  "OSW-CLI-011": {
    level: "error",
    text: "stop run needs a reason: --reason <text>",
    why: "A stop is recorded with why it was asked for.",
    todo: "Add `--reason \"<why>\"`.",
  },
  "OSW-CLI-012": {
    level: "error",
    text: "--after takes a task number, such as 4.6; it was given {given}",
    why: "`--after` names the task after which the run stops, by its number in tasks.md.",
    todo: "Give the task's number as tasks.md numbers it.",
  },
  "OSW-CLI-013": {
    level: "error",
    text: "{subcommand} needs the task's number, as tasks.md numbers it (for example 6.4)",
    why: "A task is named by its number, and none was given.",
    todo: "Add the task's number after the change's name.",
  },
  "OSW-CLI-014": {
    level: "error",
    text: "name what to do: complete task, reopen task or commit tasks",
    why: "The tasks handler was reached with no action.",
    todo: "Use one of the three subcommands.",
  },
  "OSW-CLI-015": {
    level: "error",
    text: "unknown lease action '{action}' (supported: release)",
    why: "The lease handler was reached with an action it does not take.",
    todo: "Use `openspec-ui-cli show lease` or `openspec-ui-cli remove lease`.",
  },
  "OSW-CLI-016": {
    level: "error",
    text: "answer question {change} {question} needs the answer, in quotes",
    why: "The answer was missing, or blank.",
    todo: "Put the answer after the question's id, in quotes.",
  },

  // RUN: runs, chains, stages, checkpoints, limits.
  "OSW-RUN-001": {
    level: "error",
    text: "failed to resolve change name from command.context.changeDir",
    why: "The chain was started with a change directory it could not name - a host's fault, not a person's.",
    todo: "Report it, with the host and how the run was started.",
  },
  "OSW-RUN-002": {
    level: "error",
    text: "this change's Agentic Harness autonomyLevel is \"assisted\" — start each stage individually instead of running a chain",
    why: "Under `autonomyLevel: \"assisted\"` a person starts every stage; a chain runs them one after another.",
    todo: "Start the stages one at a time, or raise the change's autonomyLevel to \"semi-autonomous\".",
  },
  "OSW-RUN-003": {
    level: "error",
    text: "autonomyLevel \"autonomous\" is only reachable when this change's own openspec/changes/{change}/harness.json sets it directly — it is not settable globally, and inheriting it from elsewhere is refused",
    why: "A run without a person in it is chosen for one change at a time, in that change's own file.",
    todo: "Set `autonomyLevel: \"autonomous\"` in the change's harness.json, or run it at a lower level.",
  },
  "OSW-RUN-004": {
    level: "error",
    text: "HarnessChainRunner.run only accepts \"chain\" commands, got \"{kind}\"",
    why: "A host sent the chain runner a command it does not run - a host's fault, not a person's.",
    todo: "Report it, with the host and how the run was started.",
  },
  "OSW-RUN-005": {
    level: "error",
    text: "will not run \"{change}\": {reason}",
    why: "Something the run depends on is not so: the reason says what.",
    todo: "Do what the reason says, then run the change again.",
  },
  "OSW-RUN-006": {
    level: "info",
    text: "the setting that governs this is {setting}",
    why: "The refusal above comes from a setting, and this names it.",
    todo: "Change that setting if the refusal is not what you want.",
  },
  "OSW-RUN-101": {
    level: "error",
    text: "verification left {count} task(s) unchecked, and this chain did not run \"apply\" to send them back to: {tasks}",
    why: "\"verify\" found work unfinished, and there is no \"apply\" in this chain to finish it.",
    todo: "Finish the tasks named, or run the change from \"apply\".",
  },
  "OSW-RUN-102": {
    level: "error",
    text: "verification left {count} task(s) unchecked after \"apply\" used all {attempts} of its attempts: {tasks}",
    why: "\"verify\" sent the work back to \"apply\" as often as maxStageAttempts allows, and it is still unfinished.",
    todo: "Read the runs' replies and finish the tasks named, or raise maxStageAttempts.",
  },
  "OSW-RUN-103": {
    level: "warning",
    text: "\"apply\" changed {count} file(s) and ticked no task in tasks.md",
    why: "The implementing run changed files but marked no task done, so nothing says which work it finished.",
    todo: "Look at what it changed, and tick the tasks it finished.",
  },
  "OSW-RUN-104": {
    level: "error",
    text: "\"apply\" changed no file and ticked no task, and {count} task(s) it could do are still open ({tasks}); the chain stops here rather than verify and archive work that was not done. Read the run's reply and the questions it asked, then start the change again",
    why: "The implementing run did nothing while work of its own was open; verifying and archiving after it would spend runs on work that was not done.",
    todo: "Read the run's reply and the questions it asked, answer them, then start the change again.",
  },
  "OSW-RUN-201": {
    level: "error",
    text: "budget exceeded: recorded cost ${spent} for this change has reached the configured ceiling (${ceiling}) — stopping before the next stage, not because a stage failed",
    why: "The change's recorded cost has reached `budget.maxCostUsd`.",
    todo: "Raise the ceiling in the change's harness settings, or finish the change by hand.",
  },
  "OSW-RUN-202": {
    level: "error",
    text: "budget exceeded: recorded tokens ({spent}) for this change have reached the configured ceiling ({ceiling}) — stopping before the next stage, not because a stage failed",
    why: "The change's recorded tokens have reached `budget.maxTokens`.",
    todo: "Raise the ceiling in the change's harness settings, or finish the change by hand.",
  },
  "OSW-RUN-203": {
    level: "error",
    text: "budget exceeded: recorded cost {spent} {unit} for this change has reached the configured ceiling ({ceiling} {unit}) — stopping before the next stage, not because a stage failed",
    why: "The change's recorded cost in this unit has reached its ceiling in `budget.maxCost`.",
    todo: "Raise the ceiling in the change's harness settings, or finish the change by hand.",
  },
  "OSW-RUN-204": {
    level: "error",
    text: "stopped after \"{stage}\": it reported ${spent}, over budget.maxStageCostUsd of ${ceiling}",
    why: "One stage cost more than `budget.maxStageCostUsd`.",
    todo: "Look at what the stage did, then raise the ceiling or start the change again.",
  },
  "OSW-RUN-205": {
    level: "error",
    text: "stopped after \"{stage}\": it reported {spent} tokens, over budget.maxStageTokens of {ceiling}",
    why: "One stage used more tokens than `budget.maxStageTokens`.",
    todo: "Look at what the stage did, then raise the ceiling or start the change again.",
  },
  "OSW-RUN-206": {
    level: "warning",
    text: "stopped at the run time limit: timeout.maxRunSeconds is {seconds}s, and this chain's stages had spent {spent} before \"{stage}\" could start",
    why: "The chain's time was spent before the next stage began.",
    todo: "Raise `timeout.maxRunSeconds`, or start the change again to go on from where it stopped.",
  },
  "OSW-RUN-207": {
    level: "warning",
    text: "stopped at the run time limit: timeout.maxRunSeconds is {seconds}s, and this chain's stages had already spent {spent} before \"{stage}\" started",
    why: "The chain's time ran out while a stage was working.",
    todo: "Raise `timeout.maxRunSeconds`, or start the change again to go on from where it stopped.",
  },
  "OSW-RUN-208": {
    level: "warning",
    text: "stopped \"{stage}\" at the stage time limit: timeout.maxStageSeconds is {seconds}s",
    why: "A stage worked longer than `timeout.maxStageSeconds`.",
    todo: "Raise the limit, or look at why the stage took so long.",
  },
  "OSW-RUN-209": {
    level: "warning",
    text: "stopped \"{stage}\" after {attempts} attempt(s), the maximum configured (maxStageAttempts: {max}); the last ended because it was {reason}",
    why: "Every attempt the change allows the stage was cut by a limit.",
    todo: "Raise the limit that cut it, or maxStageAttempts.",
  },
  "OSW-RUN-210": {
    level: "info",
    text: "cancelling; press Ctrl-C again to exit at once",
    why: "Ctrl-C asks the agent to stop, and the CLI waits for it to.",
    todo: "Wait, or press Ctrl-C again to leave without waiting.",
  },
  "OSW-RUN-211": {
    level: "warning",
    text: "interrupted again — exiting without waiting for the agent to stop",
    why: "A second Ctrl-C leaves at once.",
    todo: "Check with `openspec-ui-cli show status` that the agent's process has gone.",
  },
  "OSW-RUN-212": {
    level: "error",
    text: "the run ended without reporting an outcome",
    why: "The run's events ended with neither completed, failed nor cancelled.",
    todo: "Read the run's output above; report it if nothing there explains it.",
  },

  // QST: questions to the operator.
  "OSW-QST-001": {
    level: "error",
    text: "{change} has {open} for the operator: {question} \"{text}\". Answer {them} first - on the change's card, with `openspec-ui-cli answer question {change} {question} \"<answer>\"`, or in its decisions.md.",
    why: "An agent asked the operator something, and a new run would go on without the answer.",
    todo: "Answer the question, on the card, with the command shown, or in decisions.md.",
  },
  "OSW-QST-002": {
    level: "error",
    text: "{question} was already answered; the first answer stands",
    why: "A question takes one answer.",
    todo: "Nothing: the run goes on with the first. Write to decisions.md if it must change.",
  },
  "OSW-QST-003": {
    level: "error",
    text: "{question} is not a question of {change}",
    why: "No question with that id is in the change's decisions.md.",
    todo: "Run `openspec-ui-cli show questions <change>` for the ids.",
  },
  "OSW-QST-101": {
    level: "info",
    text: "waiting for the operator's answer to {questions}",
    why: "The agent asked, and its run waits for the answer.",
    todo: "Answer on the change's card, with `openspec-ui-cli answer question`, or in decisions.md.",
  },
  "OSW-QST-102": {
    level: "info",
    text: "answered; going on as {kind}",
    why: "Every question the run waited on is answered.",
    todo: "Nothing.",
  },
  "OSW-QST-201": {
    level: "warning",
    text: "cancelled while waiting for the operator's answer; the questions stay open in decisions.md",
    why: "The run was cancelled before its questions were answered.",
    todo: "Answer them, then start the change again.",
  },

  // PRM: permission requests.
  "OSW-PRM-101": {
    level: "error",
    text: "a permission request cannot be answered under autonomyLevel \"autonomous\": {request}",
    why: "An autonomous run has nobody to ask, and it does not grant itself what it was not given.",
    todo: "Run the change at \"semi-autonomous\", or give the agent what it asked for in its settings.",
  },
  "OSW-PRM-102": {
    level: "warning",
    text: "denied, nobody at this terminal to ask: {request}",
    why: "The CLI's input is not a terminal, so nobody can answer, and the request is denied.",
    todo: "Run it in a terminal to be asked, or from the card.",
  },
} as const satisfies Record<string, MessageEntry>;

export type MessageCode = keyof typeof MESSAGES;

type ParamsOf<T extends string> = T extends `${string}{${infer Name}}${infer Rest}` ? Name | ParamsOf<Rest> : never;

/** The values a message's text names. */
export type MessageParams<C extends MessageCode> = { [Name in ParamsOf<(typeof MESSAGES)[C]["text"]>]: string | number };

/** A message as it is said: its identifier, its level and its words. */
export interface SaidMessage {
  code: MessageCode;
  level: MessageLevel;
  text: string;
}

/** The message under `code`, its values put in. */
export function say<C extends MessageCode>(
  code: C,
  ...params: [ParamsOf<(typeof MESSAGES)[C]["text"]>] extends [never] ? [] : [MessageParams<C>]
): SaidMessage {
  const entry: MessageEntry = MESSAGES[code];
  const values = (params[0] ?? {}) as Record<string, string | number>;
  const text = entry.text.replace(/\{([A-Za-z]+)\}/gu, (whole, name: string) => (name in values ? String(values[name]) : whole));
  return { code, level: entry.level, text };
}

/** Whether `code` is in the register. */
export function isMessageCode(code: unknown): code is MessageCode {
  return typeof code === "string" && Object.prototype.hasOwnProperty.call(MESSAGES, code);
}

/** A message on a line of its own: `error OSW-RUN-104: ...`. */
export function formatMessage(message: SaidMessage): string {
  return `${message.level} ${message.code}: ${message.text}`;
}

/** A reason with its identifier in front, where the line already says how it
 * ended ("failed:", "✗"): `OSW-RUN-104: ...`. The reason alone where it has
 * none. */
export function withMessageCode(text: string, code: string | undefined): string {
  return code === undefined ? text : `${code}: ${text}`;
}

/** Where docs/messages.md is read, for a label that links to its entry. */
export const MESSAGES_PAGE_URL = "https://github.com/VeryComplexAndLongName/OpenSpec-UI/blob/main/docs/messages.md";

/** The link to one identifier's entry in docs/messages.md. */
export function messageEntryUrl(code: string): string {
  return `${MESSAGES_PAGE_URL}#${code.toLowerCase()}`;
}

/** docs/messages.md: every identifier, what it says, why, and what to do. */
export function renderMessagesPage(): string {
  const lines: string[] = [
    "# Messages",
    "",
    "<!-- Generated from packages/core/src/message-register.ts by",
    "     `npm run messages --workspace @openspec-ui/core`. Do not edit. -->",
    "",
    "Everything OpenSpec Workbench says to a person is said under an",
    "identifier, `OSW-<GROUP>-<NNN>` (ADR 0046): `error OSW-RUN-104: ...`.",
    "Search this page for the identifier you saw. Within a group the hundreds",
    "say when a message is said: 0xx before anything runs, 1xx while it runs,",
    "2xx as it ends. An identifier is never given to another message.",
    "",
  ];
  const codes = Object.keys(MESSAGES) as MessageCode[];
  for (const { group, about } of MESSAGE_GROUPS) {
    const inGroup = codes.filter((code) => code.startsWith(`OSW-${group}-`)).sort();
    if (inGroup.length === 0) continue;
    lines.push(`## ${group}: ${about}`, "");
    for (const code of inGroup) {
      const entry: MessageEntry = MESSAGES[code];
      lines.push(`### ${code}`, "");
      // `<` escaped: "<answer>" would read as a tag and vanish.
      lines.push(`> ${entry.level}${entry.retired !== undefined ? ", retired" : ""}: ${entry.text.replace(/</gu, "&lt;")}`, "");
      lines.push(`Why: ${entry.why}`, "");
      lines.push(`What to do: ${entry.todo}`, "");
      if (entry.retired !== undefined) lines.push(`Retired: ${entry.retired}`, "");
    }
  }
  return lines.join("\n");
}
