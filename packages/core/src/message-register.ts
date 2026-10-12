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

export type MessageGroup = "CHG" | "RUN" | "QST" | "PRM" | "HRN" | "AGT" | "TSK" | "VAL" | "ARC" | "GIT" | "WSP" | "KEY" | "NET" | "CLI" | "PRC";

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
  { group: "PRC", about: "spawned processes: orphaned, overdue, terminated" },
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
  // CHG: a change - finding it, acting on it, where it lives.
  "OSW-CHG-001": {
    level: "warning",
    text: "\"{name}\" is not a change name this workspace can have.",
    why: "A card or a request named a change by something no change can be called.",
    todo: "Refresh the Pipeline; report it if a card shows that name.",
  },
  "OSW-CHG-002": {
    level: "info",
    text: "{name} is neither an active change of this checkout nor worked in a directory of its own - it may have been archived or deleted since the Pipeline was read.",
    why: "The change a card names is no longer where the card was read from.",
    todo: "Refresh the Pipeline.",
  },
  "OSW-CHG-003": {
    level: "info",
    text: "{action} {name}: {reason}",
    why: "The action cannot run now, for the reason given (ADR 0044).",
    todo: "Do what the reason says, then choose the action again.",
  },

  // GIT: git, branches, worktrees, push, pull requests
  // (a-change-is-committed-where-it-is-made).
  "OSW-GIT-001": {
    level: "warning",
    text: "{name} has no worktree of its own: {why}.",
    why: "Commit Change commits only in a change's own worktree, on its own branch.",
    todo: "Make the change's worktree, or work the change there.",
  },
  "OSW-GIT-002": {
    level: "warning",
    text: "{name} is on {branch}, the default branch; nothing of a change is committed there.",
    why: "A change reaches the default branch through its pull request, never by a commit on it (ADR 0043).",
    todo: "Work the change on a branch of its own, named after it.",
  },
  "OSW-GIT-101": {
    level: "error",
    text: "Nothing of {name} was committed: {why}",
    why: "git refused the commit: often no author is configured, or a hook failed.",
    todo: "Put right what git says, then choose Commit Change again.",
  },
  "OSW-GIT-102": {
    level: "error",
    text: "The push of {branch} was refused{after}: {why}",
    why: "The server, or the credentials git uses for it, refused the branch. A commit already made stays.",
    todo: "Put right what the server says - access, credentials, a branch rule - then choose Commit Change again.",
  },
  "OSW-GIT-103": {
    level: "error",
    text: "git stage failed at commit: {why}",
    why: "The git stage commits what the stages left before it pushes, and git refused that commit.",
    todo: "Put right what git says in the change's worktree, then run the chain again from git.",
  },
  "OSW-GIT-201": {
    level: "info",
    text: "Committed {name} as {commit} and pushed it to {pushedTo}.",
    why: "Commit Change committed what the change's worktree held, on its branch, and pushed the branch.",
    todo: "Nothing: the change is on the server, where every directory, host and person can see it.",
  },
  "OSW-GIT-202": {
    level: "info",
    text: "{name} had nothing to commit; its branch is pushed to {pushedTo}.",
    why: "Everything in the change's worktree was committed already, and the push brought the server up to date.",
    todo: "Nothing.",
  },
  "OSW-GIT-203": {
    level: "warning",
    text: "{name} is made in {directory}, but not on the server: {why}",
    why: "A new change is committed on its branch and pushed at once; that failed, so no other directory, host or person sees it yet.",
    todo: "Put right what was refused, then choose Commit Change on the change's card.",
  },

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

  "OSW-CLI-017": {
    level: "error",
    text: "{command} refused: {reason}",
    why: "The requested subject is absent or a core policy prevents the action.",
    todo: "Read the stated reason; inspect the change, run or workspace before retrying.",
  },
  "OSW-CLI-018": {
    level: "error",
    text: "{command} could not complete: {reason}",
    why: "Arguments, configuration or an underlying reader prevented the command from completing.",
    todo: "Correct the arguments or the reported configuration/tooling problem and retry.",
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

  // PRC: spawned processes (ADR 0050) — orphaned, overdue, terminated.
  "OSW-PRC-001": {
    level: "error",
    text: "the live process start time could not be read; refusing",
    why: "A process's identity cannot be re-verified without its operating-system start time.",
    todo: "Check that the PID still names this product's process, then retry once the system can read it.",
  },
  "OSW-PRC-002": {
    level: "error",
    text: "no start time was recorded for this process; refusing",
    why: "The process was spawned but its start time was never captured, so its identity is incomplete.",
    todo: "Terminate it by hand if it is safe to, after confirming what it is.",
  },
  "OSW-PRC-003": {
    level: "error",
    text: "the recorded start time is invalid",
    why: "The snapshot holds a start time the system cannot read as a date.",
    todo: "Report it; the snapshot's file is corrupt.",
  },
  "OSW-PRC-004": {
    level: "error",
    text: "the live start time differs from the recorded one (PID reuse)",
    why: "The operating system has reused this PID for a different process.",
    todo: "Do nothing to it; the recorded process is gone.",
  },
  "OSW-PRC-005": {
    level: "error",
    text: "recorded on {host}, this host is {local}",
    why: "The snapshot belongs to another machine, whose PID space is unrelated to this one.",
    todo: "Terminate it on that machine, not here.",
  },
  "OSW-PRC-006": {
    level: "warning",
    text: "the process ledger is not configured",
    why: "No shared state root has been set, so spawned processes are not recorded.",
    todo: "Start the Workbench normally; report it if a fresh activation still says this.",
  },
  "OSW-PRC-007": {
    level: "info",
    text: "no recorded process is still detached",
    why: "Every recorded process has exited, so nothing outlived a host restart.",
    todo: "Nothing.",
  },
  "OSW-PRC-008": {
    level: "warning",
    text: "terminate {executable} (pid {pid})? its start time is re-verified first, then the whole process tree is killed",
    why: "Terminating a process is irreversible, so the confirmation names what will be killed.",
    todo: "Confirm only for a process this product started, then terminate it.",
  },
  "OSW-PRC-009": {
    level: "error",
    text: "termination refused — {reason}",
    why: "The snapshot no longer matches the live process, so the kill was not issued.",
    todo: "Read the reason; do not force the kill.",
  },
  "OSW-PRC-010": {
    level: "info",
    text: "terminated {label}",
    why: "A confirmed process tree was killed after its identity re-verified.",
    todo: "Nothing.",
  },

  // HRN: harness settings.
  "OSW-HRN-001": {
    level: "error",
    text: "reviewGate.mode \"agent-sufficient\" is only valid in a per-change harness.json, never in the global openspec/agent-harness.json",
    why: "The global file set the review gate so an agent reviews its own work, which only one change may decide.",
    todo: "Move the setting into the change's own harness.json, or use \"human-required\" in the global file.",
  },
  "OSW-HRN-002": {
    level: "error",
    text: "autonomyLevel \"autonomous\" is only valid in a per-change harness.json, never in the global openspec/agent-harness.json",
    why: "The global file set a level that runs without a person, which is chosen for one change at a time.",
    todo: "Set the level in the change's own harness.json, or lower it in the global file.",
  },
  "OSW-HRN-003": {
    level: "error",
    text: "checkpoints.requireConfirmationBetweenSteps: false is only valid in a per-change harness.json, never in the global openspec/agent-harness.json",
    why: "The global file turned off the between-stage confirmation that only a change may waive.",
    todo: "Move the setting into the change's own harness.json, or remove it from the global file.",
  },
  "OSW-HRN-004": {
    level: "error",
    text: "gitStageAllowlist is only valid in a per-change harness.json, never in the global openspec/agent-harness.json",
    why: "A git-stage allowlist is a change's own decision about what it may push, so a global one is refused.",
    todo: "Move the allowlist into the change's own harness.json.",
  },
  "OSW-HRN-005": {
    level: "error",
    text: "taskAgents is only valid in a per-change harness.json, never in the global openspec/agent-harness.json — a task number names a task of one change",
    why: "A task number belongs to one change's tasks.md, so a workspace-wide mapping cannot mean anything.",
    todo: "Move the taskAgents section into the change's own harness.json.",
  },
  "OSW-HRN-006": {
    level: "error",
    text: "steps is only valid in a per-change harness.json, never in the global openspec/agent-harness.json — a declared step belongs to the chain of one change",
    why: "A declared step is placed in one change's chain, so a global one would apply to every change forever.",
    todo: "Move the steps list into the change's own harness.json.",
  },
  "OSW-HRN-007": {
    level: "error",
    text: "supervisor.mode \"act\" needs autonomyLevel \"autonomous\" in the same file: under a level that asks a person, the person decides. Open the change's Harness Settings and save to turn Act off, or set autonomyLevel \"autonomous\"",
    why: "Act lets the supervisor start another agent, which a level that asks a person does not allow.",
    todo: "Open the change's Harness Settings and save to turn Act off, or set autonomyLevel to \"autonomous\".",
  },
  "OSW-HRN-008": {
    level: "error",
    text: "supervisor.mode \"act\" repeats or moves a failed stage as another attempt of it, and maxStageAttempts is {attempts}: set it above 1 in this change's harness.json, or choose \"advise\"",
    why: "Act spends another attempt when it repeats or moves a stage, and a ceiling of one leaves it nothing to spend.",
    todo: "Raise maxStageAttempts above 1 in the change's harness.json, or choose \"advise\".",
  },
  "OSW-HRN-009": {
    level: "warning",
    text: "Migrated legacy harness dispatch settings in {file}: {reports}",
    why: "An older harness file used the retired dispatch keys, and the migration rewrote them so the settings are read.",
    todo: "Nothing, the migration is automatic; save the file to keep the new form.",
  },
  "OSW-HRN-010": {
    level: "warning",
    text: "stepAgents.{stage}.dispatch \"vscode-chat\" was migrated to stepAgents.{stage}.agent \"{agent}\"",
    why: "A stepAgents entry named the editor's chat through the retired dispatch key, which is now written as an agent id.",
    todo: "Nothing; the entry now names the VS Code chat agent directly.",
  },
  "OSW-HRN-011": {
    level: "warning",
    text: "stepAgents.{stage} was dropped — \"{stage}\" is a mechanical stage and never invokes an agent",
    why: "The configuration set an agent for a stage that runs no agent, so the entry never did anything.",
    todo: "Nothing; the setting was removed from the resolved configuration.",
  },
  "OSW-HRN-012": {
    level: "error",
    text: "budget.maxCost must be an object of unit to ceiling",
    why: "The per-unit budget was written as something other than a map from unit to ceiling.",
    todo: "Write it as an object, such as { \"credits\": 500 }.",
  },
  "OSW-HRN-013": {
    level: "error",
    text: "budget.maxCost has a ceiling under an empty unit",
    why: "A ceiling was filed under a blank unit name, which no report can be compared against.",
    todo: "Name the unit, or remove the entry.",
  },
  "OSW-HRN-014": {
    level: "error",
    text: "budget.maxCost.{unit} must be a positive number",
    why: "A per-unit ceiling was not a positive finite number.",
    todo: "Give the unit a positive number as its ceiling.",
  },
  "OSW-HRN-015": {
    level: "error",
    text: "{label} has unknown key \"{key}\" (accepted keys: {keys})",
    why: "An agent entry carried a key this product does not read, so it would silently do nothing.",
    todo: "Remove the key or use one of the accepted keys named.",
  },
  "OSW-HRN-016": {
    level: "error",
    text: "{label} must be a non-empty string",
    why: "An agent entry was written as something other than the agent id string it must be.",
    todo: "Write the agent id as a non-empty string.",
  },
  "OSW-HRN-017": {
    level: "error",
    text: "{label} references unknown agent id \"{agent}\"",
    why: "The entry names an agent id that no registered agent or the editor's chat has.",
    todo: "Use a registered agent id, or install the agent that id belongs to.",
  },
  "OSW-HRN-018": {
    level: "error",
    text: "{label} selects agent \"{agent}\", which is only valid under autonomyLevel \"assisted\" — a chain cannot use it",
    why: "The editor's chat can only run under assisted autonomy, where a person starts each stage.",
    todo: "Use a CLI agent under this level, or set autonomyLevel to \"assisted\".",
  },
  "OSW-HRN-019": {
    level: "error",
    text: "{label}.model cannot reach anything when agent \"{agent}\" dispatches to VS Code chat",
    why: "A model id has no effect when the entry dispatches to the editor's chat.",
    todo: "Remove the model, or choose an agent that takes a model id.",
  },
  "OSW-HRN-020": {
    level: "error",
    text: "{label}.model \"{model}\" is not a valid model id",
    why: "A model id reached a command line as a flag value and did not have the shape one may have.",
    todo: "Give a model id of letters, digits, \".\", \"_\", \":\" and \"-\", not beginning with \"-\".",
  },
  "OSW-HRN-021": {
    level: "error",
    text: "{label} sets a model, but agent \"{agent}\" does not accept one",
    why: "The named agent has no command-line way to take a model id.",
    todo: "Remove the model, or choose an agent that accepts one.",
  },
  "OSW-HRN-022": {
    level: "error",
    text: "{label}.customAgent cannot reach anything when agent \"{agent}\" dispatches to VS Code chat",
    why: "A custom agent flag has no effect when the entry dispatches to the editor's chat.",
    todo: "Remove the customAgent, or choose an agent that accepts one.",
  },
  "OSW-HRN-023": {
    level: "error",
    text: "{label}.customAgent must be a non-empty string",
    why: "The custom agent was written as something other than the flag value it must be.",
    todo: "Write the custom agent as a non-empty string.",
  },
  "OSW-HRN-024": {
    level: "error",
    text: "{label}.customAgent \"{customagent}\" must not begin with \"-\" and may contain only letters, digits, \".\", \"_\", \":\" and \"-\"",
    why: "A value that reaches argv as a flag value must not look like another flag.",
    todo: "Rename the custom agent so it begins with a letter or digit and uses only the allowed characters.",
  },
  "OSW-HRN-025": {
    level: "error",
    text: "{label} sets a custom agent, but agent \"{agent}\" does not accept one",
    why: "The named agent's command line has no flag for a custom agent.",
    todo: "Remove the customAgent, or choose an agent that accepts one.",
  },
  "OSW-HRN-026": {
    level: "error",
    text: "{label}.effort cannot reach anything when agent \"{agent}\" dispatches to VS Code chat",
    why: "A reasoning effort has no effect when the entry dispatches to the editor's chat.",
    todo: "Remove the effort, or choose an agent with an effort control.",
  },
  "OSW-HRN-027": {
    level: "error",
    text: "{label}.effort must be one of: {values}",
    why: "The effort was not one of the values this product recognises.",
    todo: "Use one of the listed effort values.",
  },
  "OSW-HRN-028": {
    level: "error",
    text: "{label} sets effort, but agent \"{agent}\" has no command-line reasoning-effort control",
    why: "The named agent has no way to be told how much reasoning to spend.",
    todo: "Remove the effort, or choose an agent that takes one.",
  },
  "OSW-HRN-029": {
    level: "error",
    text: "{label}.effort \"{effort}\" is not accepted by agent \"{agent}\" (accepted: {values})",
    why: "The named agent takes an effort, but not this one.",
    todo: "Use one of the effort values the agent accepts.",
  },
  "OSW-HRN-030": {
    level: "error",
    text: "{label}.budget cannot reach anything when agent \"{agent}\" dispatches to VS Code chat",
    why: "A budget has no effect when the entry dispatches to the editor's chat.",
    todo: "Remove the budget, or choose an agent that takes a cap.",
  },
  "OSW-HRN-031": {
    level: "error",
    text: "{label}.budget must be an object",
    why: "The entry's budget was written as something other than an object of caps.",
    todo: "Write the budget as an object with maxCostUsd or maxAiCredits.",
  },
  "OSW-HRN-032": {
    level: "error",
    text: "{label}.budget has unknown key \"{key}\" (accepted keys: {keys})",
    why: "The budget carried a cap key this product does not read.",
    todo: "Remove the key or use one of the accepted keys named.",
  },
  "OSW-HRN-033": {
    level: "error",
    text: "{label}.budget must set maxCostUsd or maxAiCredits",
    why: "The budget was present but named no cap at all.",
    todo: "Set maxCostUsd or maxAiCredits, or remove the budget.",
  },
  "OSW-HRN-034": {
    level: "error",
    text: "{label}.budget.maxCostUsd must be a positive number",
    why: "The per-stage dollar cap was not a positive finite number.",
    todo: "Give it a positive number.",
  },
  "OSW-HRN-035": {
    level: "error",
    text: "{label} sets budget.maxCostUsd, but agent \"{agent}\" does not accept a cost cap in USD",
    why: "The named agent's command line has no dollar cost cap.",
    todo: "Remove maxCostUsd, or choose an agent billed in a unit it caps.",
  },
  "OSW-HRN-036": {
    level: "error",
    text: "{label}.budget.maxAiCredits must be a positive integer",
    why: "The AI-credit cap was not a positive whole number.",
    todo: "Give it a positive whole number.",
  },
  "OSW-HRN-037": {
    level: "error",
    text: "{label} sets budget.maxAiCredits, but agent \"{agent}\" does not accept a credit cap",
    why: "The named agent's command line has no AI-credit cap.",
    todo: "Remove maxAiCredits, or choose an agent that takes one.",
  },
  "OSW-HRN-038": {
    level: "error",
    text: "{label}.budget.maxAiCredits must be at least {minimum} (copilot-cli's own minimum)",
    why: "copilot-cli refuses a credit cap below its own minimum.",
    todo: "Raise the cap to at least the named minimum.",
  },
  "OSW-HRN-039": {
    level: "error",
    text: "stepAgents must be an object",
    why: "The stepAgents section was written as something other than an object of stage entries.",
    todo: "Write it as an object keyed by stage.",
  },
  "OSW-HRN-040": {
    level: "error",
    text: "stepAgents.{stage} is not accepted — \"{stage}\" is a mechanical stage and never invokes an agent",
    why: "The stage runs no agent, so an entry for it can never do anything.",
    todo: "Remove the entry from stepAgents.",
  },
  "OSW-HRN-041": {
    level: "error",
    text: "unknown stepAgents key \"{stage}\" (expected one of: {stages})",
    why: "A stepAgents key is not a stage that runs an agent.",
    todo: "Use one of the listed stage names.",
  },
  "OSW-HRN-042": {
    level: "error",
    text: "taskAgents must be an object",
    why: "The taskAgents section was written as something other than an object of task entries.",
    todo: "Write it as an object keyed by task number.",
  },
  "OSW-HRN-043": {
    level: "error",
    text: "taskAgents key \"{task}\" is not a task number (expected the leading number of a tasks.md line, such as \"5.4\")",
    why: "An entry filed under something other than a task number can never match a task line.",
    todo: "Key the entry by the leading number of a tasks.md line.",
  },
  "OSW-HRN-044": {
    level: "error",
    text: "{label} selects agent \"{agent}\", which cannot run one task — a delegated item's run spawns a CLI agent",
    why: "A numbered task is delegated to a spawned CLI agent, which the editor's chat cannot be.",
    todo: "Use a CLI agent for the task.",
  },
  "OSW-HRN-045": {
    level: "error",
    text: "autonomyLevel must be one of: {levels}",
    why: "The autonomy level was not one this product recognises.",
    todo: "Use one of the listed autonomy levels.",
  },
  "OSW-HRN-046": {
    level: "error",
    text: "reviewGate must be an object",
    why: "The review gate was written as something other than an object with a mode.",
    todo: "Write it as an object with a mode of \"human-required\" or \"agent-sufficient\".",
  },
  "OSW-HRN-047": {
    level: "error",
    text: "reviewGate.mode must be one of: {modes}",
    why: "The review gate mode was not one this product recognises.",
    todo: "Use \"human-required\" or \"agent-sufficient\".",
  },
  "OSW-HRN-048": {
    level: "error",
    text: "hints must be an object",
    why: "The hints section was written as something other than an object with an enabled flag.",
    todo: "Write it as an object with an enabled boolean.",
  },
  "OSW-HRN-049": {
    level: "error",
    text: "hints.enabled must be a boolean",
    why: "The hints switch was not true or false.",
    todo: "Set hints.enabled to true or false.",
  },
  "OSW-HRN-050": {
    level: "error",
    text: "supervisor must be an object",
    why: "The supervisor section was written as something other than an object of its keys.",
    todo: "Write it as an object of the accepted supervisor keys.",
  },
  "OSW-HRN-051": {
    level: "error",
    text: "supervisor has no key \"{key}\" (accepted keys: {keys})",
    why: "The supervisor section carried a key this product does not read.",
    todo: "Remove the key or use one of the accepted keys named.",
  },
  "OSW-HRN-052": {
    level: "error",
    text: "supervisor.mode must be one of: {modes}",
    why: "The supervisor mode was not one this version knows, and an unknown mode is refused rather than read as advise.",
    todo: "Use \"off\", \"advise\" or \"act\".",
  },
  "OSW-HRN-053": {
    level: "error",
    text: "supervisor.mode \"act\" is set in a change's own harness.json, never for the whole workspace: it may start another agent unattended",
    why: "Acting may start another agent, which is a change's own decision, not a workspace default.",
    todo: "Move supervisor.mode \"act\" into the change's own harness.json.",
  },
  "OSW-HRN-054": {
    level: "error",
    text: "supervisor.{key} must be a positive whole number of seconds",
    why: "A supervisor threshold was not a positive whole number of seconds.",
    todo: "Give it a positive whole number.",
  },
  "OSW-HRN-055": {
    level: "error",
    text: "supervisor.{key} must be a boolean",
    why: "A supervisor switch was not true or false.",
    todo: "Set it to true or false.",
  },
  "OSW-HRN-056": {
    level: "error",
    text: "supervisor.{key} is set in a change's own harness.json, never for the whole workspace",
    why: "Allowing a cost or provider change is a decision only one change may make.",
    todo: "Move the key into the change's own harness.json.",
  },
  "OSW-HRN-057": {
    level: "error",
    text: "supervisor.fallback must be an object of stages",
    why: "The fallback section was written as something other than an object keyed by stage.",
    todo: "Write it as an object mapping stage names to agent lists.",
  },
  "OSW-HRN-058": {
    level: "error",
    text: "supervisor.fallback.{stage} names no stage that runs an agent",
    why: "A fallback was declared for a stage that invokes no agent.",
    todo: "Remove the entry, or name a stage that runs an agent.",
  },
  "OSW-HRN-059": {
    level: "error",
    text: "supervisor.fallback.{stage} must be a non-empty list of agent ids",
    why: "A fallback for a stage was written as something other than a non-empty list of agent ids.",
    todo: "Give the stage a non-empty list of registered agent ids.",
  },
  "OSW-HRN-060": {
    level: "error",
    text: "supervisor.fallback.{stage} may not name {agent}: a chain cannot hand a stage it attempts again to the editor's chat",
    why: "A chain retries a stage by spawning a CLI agent, which the editor's chat cannot be.",
    todo: "Use a CLI agent in the fallback list.",
  },
  "OSW-HRN-061": {
    level: "error",
    text: "supervisor.fallback.{stage} names \"{agent}\", which is not a registered agent",
    why: "A fallback names an agent id no registered agent has.",
    todo: "Use a registered agent id, or install that agent.",
  },
  "OSW-HRN-062": {
    level: "error",
    text: "supervisor.fallback.{stage} names \"{agent}\" twice",
    why: "A fallback list that repeats an agent would try it twice for one failure.",
    todo: "Remove the duplicate entry.",
  },
  "OSW-HRN-063": {
    level: "error",
    text: "checkpoints must be an object",
    why: "The checkpoints section was written as something other than an object.",
    todo: "Write it as an object with requireConfirmationBetweenSteps.",
  },
  "OSW-HRN-064": {
    level: "error",
    text: "checkpoints.requireConfirmationBetweenSteps must be a boolean",
    why: "The between-stage confirmation switch was not true or false.",
    todo: "Set requireConfirmationBetweenSteps to true or false.",
  },
  "OSW-HRN-065": {
    level: "error",
    text: "budget must be an object",
    why: "The budget section was written as something other than an object of ceilings.",
    todo: "Write it as an object of the accepted budget keys.",
  },
  "OSW-HRN-066": {
    level: "error",
    text: "budget.maxCostUsd must be a positive number",
    why: "The whole-chain dollar ceiling was not a positive finite number.",
    todo: "Give it a positive number.",
  },
  "OSW-HRN-067": {
    level: "error",
    text: "budget.maxTokens must be a positive integer",
    why: "The whole-chain token ceiling was not a positive whole number.",
    todo: "Give it a positive whole number.",
  },
  "OSW-HRN-068": {
    level: "error",
    text: "budget.maxStageCostUsd must be a positive number",
    why: "The per-stage dollar ceiling was not a positive finite number.",
    todo: "Give it a positive number.",
  },
  "OSW-HRN-069": {
    level: "error",
    text: "budget.maxStageTokens must be a positive integer",
    why: "The per-stage token ceiling was not a positive whole number.",
    todo: "Give it a positive whole number.",
  },
  "OSW-HRN-070": {
    level: "error",
    text: "budget.maxContextShare must be a share above 0 and at most 1, such as 0.8 for eighty percent",
    why: "The context ceiling is a share, and a value like 80 would never fire.",
    todo: "Write the share as a fraction above 0 and at most 1.",
  },
  "OSW-HRN-071": {
    level: "error",
    text: "budget.maxStageCostUsd ({stage}) must not exceed budget.maxCostUsd ({chain}), because the chain ceiling would stop the run first and the stage ceiling could never fire",
    why: "A per-stage ceiling above the chain ceiling can never be reached.",
    todo: "Lower the stage ceiling, or raise the chain ceiling above it.",
  },
  "OSW-HRN-072": {
    level: "error",
    text: "budget.maxStageTokens ({stage}) must not exceed budget.maxTokens ({chain}), because the chain ceiling would stop the run first and the stage ceiling could never fire",
    why: "A per-stage token ceiling above the chain ceiling can never be reached.",
    todo: "Lower the stage ceiling, or raise the chain ceiling above it.",
  },
  "OSW-HRN-073": {
    level: "error",
    text: "timeout must be an object",
    why: "The timeout section was written as something other than an object of limits.",
    todo: "Write it as an object with maxRunSeconds or maxStageSeconds.",
  },
  "OSW-HRN-074": {
    level: "error",
    text: "timeout.{key} must be a positive integer number of seconds",
    why: "A time ceiling was not a positive whole number of seconds.",
    todo: "Give it a positive whole number of seconds.",
  },
  "OSW-HRN-075": {
    level: "error",
    text: "timeout.maxStageSeconds ({stage}) must not exceed timeout.maxRunSeconds ({run}), because the run ceiling would stop the chain first and the stage ceiling could never fire",
    why: "A per-stage time limit above the run limit can never be reached.",
    todo: "Lower the stage limit, or raise the run limit above it.",
  },
  "OSW-HRN-076": {
    level: "error",
    text: "skipStages must be a list of stage names",
    why: "The skipStages value was written as something other than a list of stage names.",
    todo: "Write it as a list, such as [\"review\"].",
  },
  "OSW-HRN-077": {
    level: "error",
    text: "skipStages may leave out only \"review\"; \"{stage}\" is not a stage it can skip",
    why: "Only the review stage may be left out of a chain.",
    todo: "Remove the stage name, or use \"review\".",
  },
  "OSW-HRN-078": {
    level: "error",
    text: "skipStages names \"{stage}\" twice",
    why: "A stage listed twice would be skipped twice for no reason.",
    todo: "Remove the duplicate.",
  },
  "OSW-HRN-079": {
    level: "error",
    text: "maxStageAttempts must be a positive integer",
    why: "The stage attempt ceiling was not a positive whole number.",
    todo: "Give it a positive whole number.",
  },
  "OSW-HRN-080": {
    level: "error",
    text: "gitStageAllowlist must be an object",
    why: "The allowlist was written as something other than an object of patterns.",
    todo: "Write it as an object with remotes and branches.",
  },
  "OSW-HRN-081": {
    level: "error",
    text: "gitStageAllowlist has unknown key \"{key}\" (accepted keys: {keys})",
    why: "The allowlist carried a key this product does not read.",
    todo: "Remove the key or use one of the accepted keys named.",
  },
  "OSW-HRN-082": {
    level: "error",
    text: "gitStageAllowlist.remotes must be a non-empty string array",
    why: "The remotes pattern list was empty or held something that is not a string.",
    todo: "Give it a non-empty list of remote patterns.",
  },
  "OSW-HRN-083": {
    level: "error",
    text: "gitStageAllowlist.branches must be a non-empty string array",
    why: "The branches pattern list was empty or held something that is not a string.",
    todo: "Give it a non-empty list of branch patterns.",
  },
  "OSW-HRN-084": {
    level: "error",
    text: "unrecognized top-level key \"{key}\" (accepted keys: {keys}).{hint}",
    why: "A harness file carried a top-level key the schema does not define, which would otherwise be silently ignored.",
    todo: "Remove the key, or use the accepted key it was meant to be.",
  },
  "OSW-HRN-085": {
    level: "error",
    text: "root value must be an object",
    why: "The harness file's JSON was not an object at all.",
    todo: "Write the file as a JSON object of settings.",
  },
  "OSW-HRN-086": {
    level: "error",
    text: "allowAgentMessages must be a boolean",
    why: "The switch that lets a run take another run's messages was not true or false.",
    todo: "Set allowAgentMessages to true or false.",
  },
  "OSW-HRN-087": {
    level: "error",
    text: "branches must be an object",
    why: "The branches section was written as something other than an object.",
    todo: "Write it as an object with rebaseWhenBehind or followMain.",
  },
  "OSW-HRN-088": {
    level: "error",
    text: "branches has no key \"{key}\"; the ones it takes are rebaseWhenBehind and followMain",
    why: "The branches section carried a key this product does not read.",
    todo: "Remove the key, or use rebaseWhenBehind or followMain.",
  },
  "OSW-HRN-089": {
    level: "error",
    text: "branches.{key} must be a boolean",
    why: "A branch switch was not true or false.",
    todo: "Set it to true or false.",
  },
  "OSW-HRN-090": {
    level: "error",
    text: "archive must be an object",
    why: "The archive section was written as something other than an object.",
    todo: "Write it as an object with whenLanded.",
  },
  "OSW-HRN-091": {
    level: "error",
    text: "archive has no key \"{key}\"; the one it takes is whenLanded",
    why: "The archive section carried a key this product does not read.",
    todo: "Remove the key, or use whenLanded.",
  },
  "OSW-HRN-092": {
    level: "error",
    text: "archive.whenLanded must be a boolean",
    why: "The landed-archive switch was not true or false.",
    todo: "Set archive.whenLanded to true or false.",
  },
  "OSW-HRN-093": {
    level: "error",
    text: "steps must be an array",
    why: "The declared steps were written as something other than a list.",
    todo: "Write steps as a JSON array of step declarations.",
  },
  "OSW-HRN-094": {
    level: "error",
    text: "{label} must be an object",
    why: "One declared step was written as something other than an object.",
    todo: "Write that step as an object with step and exactly one of before or after.",
  },
  "OSW-HRN-095": {
    level: "error",
    text: "unrecognized key \"{key}\" in {label} (accepted keys: {keys})",
    why: "A declared step carried a key this product does not read.",
    todo: "Remove the key or use one of the accepted keys named.",
  },
  "OSW-HRN-096": {
    level: "error",
    text: "{label}.step is not a declared step (expected one of: {steps})",
    why: "The step name is not in the closed registry of steps this product runs.",
    todo: "Use one of the listed step names.",
  },
  "OSW-HRN-097": {
    level: "error",
    text: "{label} must state exactly one of \"before\" or \"after\"{suffix}",
    why: "A declared step must be placed against exactly one fixed stage.",
    todo: "State exactly one position: before or after.",
  },
  "OSW-HRN-098": {
    level: "error",
    text: "{label}.{position} must name a stage (expected one of: {stages}) — a step is placed against the fixed sequence, never against another declared step",
    why: "A declared step is placed against a fixed stage, not against another declared step.",
    todo: "Use one of the listed fixed stage names.",
  },
  "OSW-HRN-099": {
    level: "error",
    text: "{label}.param must be a string",
    why: "The step's argument was written as something other than text.",
    todo: "Write the param as a string, or remove it.",
  },
  "OSW-HRN-100": {
    level: "error",
    text: "{label}.param is required for step \"{step}\"",
    why: "This step cannot run without its own argument.",
    todo: "Add the param the step needs.",
  },
  "OSW-HRN-101": {
    level: "error",
    text: "{label}.maxWaitSeconds must be a positive number of seconds",
    why: "The waiting step's time limit was not a positive finite number of seconds.",
    todo: "Give it a positive number of seconds.",
  },
  "OSW-HRN-102": {
    level: "error",
    text: "steps[{index}] ({step}) is placed {position} \"{stage}\", which skipStages leaves out; place it against another stage",
    why: "A declared step placed against a skipped stage would never run and would say nothing.",
    todo: "Place the step against a stage that is not skipped.",
  },
  "OSW-HRN-103": {
    level: "warning",
    text: "\"{agent}\" answers in text and edits no file, so \"{stage}\" on it writes nothing: the proposal, the implementation and the ticked tasks are files. It can review.",
    why: "The stage's work must be left in files, and this agent only answers in text.",
    todo: "Choose an agent that edits files for this stage, or accept that the stage writes nothing.",
  },
  "OSW-HRN-104": {
    level: "warning",
    text: "\"{agent}\" never says how full its context is, so budget.maxContextShare cannot act on \"{stage}\". That ceiling reads a figure only an ACP agent sends.",
    why: "The agent sends no context gauge, so the context ceiling has no figure to compare.",
    todo: "Use an agent that sends a context gauge, or drop budget.maxContextShare.",
  },
  "OSW-HRN-105": {
    level: "warning",
    text: "\"{agent}\" has never been observed reporting its usage here, so whether a spending ceiling can act on \"{stage}\" is not known. A time ceiling needs no report and applies regardless.",
    why: "The agent's usage reporting has never been watched, so no ceiling's effect can be asserted.",
    todo: "Configure a time ceiling, which needs no report, and watch a run to learn what the agent reports.",
  },
  "OSW-HRN-106": {
    level: "warning",
    text: "\"{agent}\" reports no usage at all, so no spending ceiling can act on \"{stage}\" however large the spend.",
    why: "The agent reports nothing for a spending ceiling to compare against.",
    todo: "Use a time or context ceiling, or choose an agent that reports usage.",
  },
  "OSW-HRN-107": {
    level: "warning",
    text: "\"{stage}\" can run without any bound: \"{agent}\" reports nothing for a spending ceiling to compare, and no timeout is configured. A time ceiling is the only one that applies here.",
    why: "Nothing bounds the stage: the agent reports no usage and no time limit is set.",
    todo: "Configure timeout.maxStageSeconds or maxRunSeconds for the stage.",
  },
  "OSW-HRN-108": {
    level: "warning",
    text: "\"{agent}\" reports tokens and no cost, so a cost ceiling cannot act on \"{stage}\". A token ceiling is the one that can.",
    why: "The agent counts tokens but not money, so a dollar ceiling has nothing to compare.",
    todo: "Use budget.maxTokens or budget.maxStageTokens instead of a cost ceiling.",
  },
  "OSW-HRN-109": {
    level: "warning",
    text: "budget.maxCost sets a ceiling in \"{unit}\", and \"{agent}\" is billed in {billing}, so that ceiling cannot act on \"{stage}\". The ceiling in its own unit is the one that can.",
    why: "The ceiling's unit does not match the unit the agent is billed in, so nothing is ever converted.",
    todo: "Set the ceiling in the unit the agent is billed in.",
  },
  "OSW-HRN-110": {
    level: "warning",
    text: "A token ceiling counts input plus output only, and \"{agent}\" moves most of its tokens through cache — a measured run recorded 1,693,507 cache tokens against 8,322 counted ones, so a token ceiling will rarely act on \"{stage}\". A cost ceiling acts on it directly.",
    why: "A cache-heavy agent's counted tokens are a small fraction of what it moves, so a token ceiling rarely fires.",
    todo: "Use a cost ceiling, or expect the token ceiling to act late.",
  },
  "OSW-HRN-111": {
    level: "error",
    text: "\"{change}\" is not a valid change name",
    why: "The chain was started with a name no change may have.",
    todo: "Name the change as its folder under openspec/changes is named.",
  },
  "OSW-HRN-112": {
    level: "error",
    text: "no active change named \"{change}\" in {directory} — an archived change is finished and is not re-run",
    why: "No active change of that name exists, and an archived change is not run again.",
    todo: "Check the name, or create the change first.",
  },
  "OSW-HRN-113": {
    level: "error",
    text: "this change's harness configuration could not be read: {reason}",
    why: "The change's harness.json is malformed or invalid, so the chain cannot know how to run.",
    todo: "Fix the configuration the reason names, then start the chain again.",
  },
  "OSW-HRN-114": {
    level: "error",
    text: "this change's autonomyLevel is \"{level}\", which starts one stage at a time through a picker rather than running a chain. There is nothing to open here; start the stage from the standalone shell or the VS Code command, or set a chain-running autonomy level for this change.",
    why: "The change's autonomy level runs stages one at a time, so there is no chain to start.",
    todo: "Start the stage individually, or set a chain-running autonomy level for the change.",
  },
  "OSW-HRN-115": {
    level: "error",
    text: "this change's configuration pauses between stages for a confirmation, and there is no terminal here to put that choice to. Run it where somebody can answer, or set checkpoints.requireConfirmationBetweenSteps to false in openspec/changes/{change}/harness.json to say that this change may run unattended.",
    why: "The change asks for a confirmation between stages, and nothing here can put that question to a person.",
    todo: "Run it where somebody can answer, or turn the confirmation off in the change's harness.json.",
  },
  "OSW-HRN-116": {
    level: "error",
    text: "this change declares that it is blocked by {blockers}, which {verb} still active. Land it and archive it, or remove the line from openspec/changes/{change}/.openspec.yaml — there is no option that starts it anyway, because the declaration is a sentence its author wrote in a file under version control.",
    why: "The change declares a blocker that is still active, and the declaration itself refuses the run.",
    todo: "Land and archive the blocker, or remove the blocking line from the change's .openspec.yaml.",
  },
  "OSW-HRN-117": {
    level: "error",
    text: "steps[{index}] waits for \"{change}\", which is this change itself — a change cannot wait for itself, and this reads as the name of another one",
    why: "A declared await-change step names the change it belongs to, which would wait forever.",
    todo: "Point the step at the change it actually waits for.",
  },
  "OSW-HRN-118": {
    level: "error",
    text: "the \"{stage}\" stage names agent \"{agent}\", which this build has no runner for",
    why: "This build ships no runner for the agent the stage names.",
    todo: "Install that agent or choose one this build can run.",
  },
  "OSW-HRN-119": {
    level: "error",
    text: "the \"{stage}\" stage has no agent configured and this build has no default runner",
    why: "The stage names no agent and this build has no default runner to fall back to.",
    todo: "Set an agent for the stage in the change's harness.json.",
  },
  "OSW-HRN-120": {
    level: "warning",
    text: "{agent} is not a registered agent",
    why: "A fallback candidate is not one of the agents this build knows.",
    todo: "Add the agent to the fallback list only if this build ships it.",
  },
  "OSW-HRN-121": {
    level: "warning",
    text: "{agent} is another provider ({provider}), and allowProviderChange is false",
    why: "Moving the stage to that agent would send the change's files to another company, which this change has not allowed.",
    todo: "Set supervisor.allowProviderChange to true, or choose a fallback on the same provider.",
  },
  "OSW-HRN-122": {
    level: "warning",
    text: "{agent} may cost money, and allowCostIncrease is false",
    why: "Moving the stage to that agent may cost more, which this change has not allowed.",
    todo: "Set supervisor.allowCostIncrease to true, or choose a free fallback.",
  },
  "OSW-HRN-123": {
    level: "info",
    text: "the cause is not known, so the stage is neither repeated nor moved",
    why: "The failure's cause could not be diagnosed, so the supervisor cannot tell whether repeating or moving would help.",
    todo: "Read the run's reply and diagnose the failure before acting.",
  },
  "OSW-HRN-124": {
    level: "info",
    text: "{cause}, and {stage} names no fallback agent",
    why: "The stage has no fallback configured, so the supervisor has nowhere to move it.",
    todo: "Add a fallback list for the stage if a move might help.",
  },
  "OSW-HRN-125": {
    level: "info",
    text: "{cause}, and the policy refuses every fallback left: {refusals}",
    why: "Every fallback the stage names is refused by the change's policy, so no move is possible.",
    todo: "Allow the cost or provider change, or add a fallback the policy permits.",
  },
  "OSW-HRN-126": {
    level: "info",
    text: "{cause}, and every fallback for {stage} has been tried",
    why: "The stage has already run on each of its fallbacks, so none is left to try.",
    todo: "Fix the underlying cause, or add a further fallback.",
  },
  "OSW-HRN-127": {
    level: "info",
    text: "{cause} (passed over: {refusals})",
    why: "The stage moved to a fallback and this names the ones skipped on the way, so a person can see why.",
    todo: "Nothing, unless the passed-over agents were the ones you wanted.",
  },

  // AGT: agents and adapters: missing, signed out, failed.
  "OSW-AGT-001": {
    level: "warning",
    text: "not valid JSON",
    why: "A status record or roster file on disk could not be read as JSON.",
    todo: "Report it; the file is corrupt and the record it was meant to carry is not trusted.",
  },
  "OSW-AGT-002": {
    level: "warning",
    text: "its signed payload is not valid JSON",
    why: "A signed status record's payload did not parse after its signature verified.",
    todo: "Report it; the record cannot be trusted and is not read.",
  },
  "OSW-AGT-003": {
    level: "warning",
    text: "missing or invalid required fields",
    why: "A status record or roster entry lacks a field the reader needs to trust it.",
    todo: "Report it; the file is written wrongly and is not trusted.",
  },
  "OSW-AGT-004": {
    level: "warning",
    text: "record identity \"{instanceId}\" does not match file name \"{expectedId}\"",
    why: "A status record names an instance other than the file it was found in.",
    todo: "Report it; the record is not taken as the run's own.",
  },
  "OSW-AGT-005": {
    level: "warning",
    text: "activityAt or heartbeatAt is not a valid timestamp",
    why: "A status record's activity or heartbeat time could not be read as a date.",
    todo: "Report it; the record's age cannot be judged.",
  },
  "OSW-AGT-006": {
    level: "warning",
    text: "not an entry",
    why: "A roster file did not hold a JSON object.",
    todo: "Report it; the file is not taken as an enrolment.",
  },
  "OSW-AGT-007": {
    level: "warning",
    text: "its file name does not match its key id \"{keyId}\"",
    why: "A roster file is named for a key id other than the one it holds.",
    todo: "Report it; the entry is not trusted.",
  },
  "OSW-AGT-008": {
    level: "warning",
    text: "its key does not match its key id",
    why: "A roster entry's public key does not match the key id it claims.",
    todo: "Report it; the entry is not trusted.",
  },
  "OSW-AGT-009": {
    level: "error",
    text: "the key offered for {keyId} does not match that key id",
    why: "An enrolment was offered a public key that does not match the key id it names.",
    todo: "Read the machine's key again, and enrol only a key that matches its id.",
  },
  "OSW-AGT-010": {
    level: "error",
    text: "{keyId} is already enrolled with a different key",
    why: "A key id is already enrolled here under another public key.",
    todo: "Remove the old enrolment, or enrol the machine under a new key.",
  },
  "OSW-AGT-101": {
    level: "warning",
    text: "not verified",
    why: "A stop request or message was not signed by a key the roster knows.",
    todo: "Enrol the sender's key, or ask from a machine whose key is enrolled.",
  },
  "OSW-AGT-102": {
    level: "warning",
    text: "stale",
    why: "A stop request or message arrived after the window in which a run acts on it.",
    todo: "Ask again from the run's card while the run is live.",
  },
  "OSW-AGT-103": {
    level: "warning",
    text: "already read",
    why: "The same stop request or message was read and acted on before.",
    todo: "Nothing; a request is read once and not acted on twice.",
  },
  "OSW-AGT-104": {
    level: "warning",
    text: "from a run, which this run does not take",
    why: "A message was written by another run, and this run does not take instructions from a run.",
    todo: "Turn on allowAgentMessages for this run, or send the message as a person.",
  },
  "OSW-AGT-201": {
    level: "error",
    text: "the agent is not installed",
    why: "The agent's executable was not found, so the run could not start it.",
    todo: "Install the agent, or choose another agent for the stage.",
  },
  "OSW-AGT-202": {
    level: "error",
    text: "the agent is not signed in",
    why: "The agent refused the work because no signed-in account was found.",
    todo: "Sign the agent in, then start the run again.",
  },
  "OSW-AGT-203": {
    level: "error",
    text: "the machine blocked the agent",
    why: "Security software or file permissions stopped the agent from a file or a program.",
    todo: "Allow the agent there, then start the run again.",
  },
  "OSW-AGT-204": {
    level: "error",
    text: "the network could not be reached",
    why: "The agent could not reach the service it works through.",
    todo: "Check the address, the connection and any system proxy, then start the run again.",
  },
  "OSW-AGT-205": {
    level: "warning",
    text: "the service rate-limited the agent",
    why: "The service limited how often it may be asked.",
    todo: "Wait for the limit to pass, then start the run again.",
  },
  "OSW-AGT-206": {
    level: "error",
    text: "the service failed",
    why: "The service failed on its own side while the run was working.",
    todo: "Start the run again; the service's own failure often passes.",
  },
  "OSW-AGT-207": {
    level: "info",
    text: "the cause is not known",
    why: "The failure's reason and output matched no cause this product knows.",
    todo: "Read the run's output, and report it if nothing there explains the failure.",
  },
  "OSW-AGT-208": {
    level: "warning",
    text: "repeating will not help",
    why: "The cause is one a repeat of the run meets again unchanged.",
    todo: "Do what the remedy says instead of starting the run again.",
  },
  "OSW-AGT-209": {
    level: "info",
    text: "repeating is likely to help",
    why: "The cause is one that passes by itself.",
    todo: "Start the run again after a moment.",
  },
  "OSW-AGT-210": {
    level: "info",
    text: "whether repeating helps is not known",
    why: "No cause was recognised, so whether a repeat helps is unknown.",
    todo: "Read the run's output before deciding to start it again.",
  },
  "OSW-AGT-211": {
    level: "info",
    text: "Install `{executable}` and make sure it is on the PATH, or choose another agent for this stage.",
    why: "The agent's executable is not installed, and this names it.",
    todo: "Install it and put it on the PATH, or choose another agent for the stage.",
  },
  "OSW-AGT-212": {
    level: "info",
    text: "Install the agent and make sure it is on the PATH, or choose another agent for this stage.",
    why: "The agent is not installed and its executable is not known by name.",
    todo: "Install the agent and put it on the PATH, or choose another agent for the stage.",
  },
  "OSW-AGT-213": {
    level: "info",
    text: "Run `{executable}` in a terminal and sign in, then start the run again.",
    why: "The agent is not signed in, and this names the executable that signs it in.",
    todo: "Run it in a terminal, sign in, then start the run again.",
  },
  "OSW-AGT-214": {
    level: "info",
    text: "Sign the agent in, then start the run again.",
    why: "The agent is not signed in and its executable is not known by name.",
    todo: "Sign the agent in, then start the run again.",
  },
  "OSW-AGT-215": {
    level: "info",
    text: "Something on this machine refused the agent a file or a program: security software, or the file's permissions. Allow it there, then start the run again.",
    why: "The machine, not the service, blocked the agent from a file or a program.",
    todo: "Allow the agent in the security software or the file's permissions, then start the run again.",
  },
  "OSW-AGT-216": {
    level: "info",
    text: "The service limited how often it may be asked. Wait, then start the run again.",
    why: "The service rate-limited the run, and waiting is what clears it.",
    todo: "Wait for the limit to pass, then start the run again.",
  },
  "OSW-AGT-217": {
    level: "info",
    text: "The service failed on its side. Starting the run again is likely to work.",
    why: "The service, not the run, failed, and such a failure often passes.",
    todo: "Start the run again.",
  },
  "OSW-AGT-218": {
    level: "error",
    text: "agent refused the prompt",
    why: "The ACP agent ended its turn with a stop reason of refusal.",
    todo: "Read what the agent said, then start the run again or change the prompt.",
  },
  "OSW-AGT-219": {
    level: "error",
    text: "cancellation could not be carried out: {killFailure}. The agent process may still be running.",
    why: "The cancellation could not kill the agent's process tree, for the reason given.",
    todo: "Check for the agent's process and terminate it by hand if it is still running.",
  },
  "OSW-AGT-220": {
    level: "error",
    text: "the agent process did not exit within {seconds}s of being terminated, and may still be running.",
    why: "The ACP agent's process outlived the confirmation window after being terminated.",
    todo: "Check for the agent's process and terminate it by hand if it is still running.",
  },
  "OSW-AGT-221": {
    level: "error",
    text: "no agent available to run the \"{stage}\" stage",
    why: "This host resolved no runner for the stage's agent, so the stage can run no work and the chain fails.",
    todo: "Configure or install an agent for that stage (or sign in the one it names), then run the change again.",
  },

  // TSK: tasks: ticks, Human-only, delegation.
  "OSW-TSK-001": {
    level: "error",
    text: "change \"{change}\" has no tasks.md",
    why: "A delegated item was asked for a change whose tasks.md does not exist.",
    todo: "Check the change name, and that its tasks.md exists.",
  },
  "OSW-TSK-002": {
    level: "error",
    text: "no task at line {line} of {change}/tasks.md",
    why: "The inbox asked to run the item at a line the change's task list does not have.",
    todo: "Refresh the inbox and choose the item again.",
  },
  "OSW-TSK-003": {
    level: "error",
    text: "task at line {line} of {change}/tasks.md is already ticked",
    why: "A delegated run was asked for an item that is already closed.",
    todo: "Refresh the inbox and run an item that is still open.",
  },
  "OSW-TSK-004": {
    level: "error",
    text: "the item at line {line} of {change}/tasks.md is marked for a person, and no agent is offered for it",
    why: "An item marked Human-only is for a person, and delegation is refused rather than quietly offered to an agent.",
    todo: "Do the item yourself, or remove the Human-only marking if an agent may do it.",
  },
  "OSW-TSK-005": {
    level: "error",
    text: "the item at line {line} of {change}/tasks.md names no agent",
    why: "The item is not delegated to anything, so there is no agent to run.",
    todo: "Name an agent in the item's \"Delegated to <id>\" marker or in the change's taskAgents.",
  },
  "OSW-TSK-006": {
    level: "error",
    text: "\"{agent}\" is not an agent this build recognises",
    why: "The item names an agent id that is not in this build's registry.",
    todo: "Correct the id, or use an agent this build carries.",
  },
  "OSW-TSK-007": {
    level: "error",
    text: "change \"{change}\" was not found in this workspace",
    why: "The change is not among the workspace's active changes, so its directory cannot be used.",
    todo: "Refresh the Pipeline and check that the change is active.",
  },
  "OSW-TSK-008": {
    level: "error",
    text: "no runner is configured for agent \"{agent}\"",
    why: "The agent id is known, but the host has no runner registered for it.",
    todo: "Configure the agent in the host, or choose another agent.",
  },
  "OSW-TSK-009": {
    level: "error",
    text: "the line at {line} of {change}/tasks.md is not a checklist item",
    why: "The line the inbox reported no longer holds a checklist item.",
    todo: "Refresh the inbox and choose the item again.",
  },
  "OSW-TSK-010": {
    level: "error",
    text: "Unknown mechanical check \"{name}\" (expected one of: {checks})",
    why: "A task's check(...) declaration names a mechanical check outside the registry.",
    todo: "Use one of the checks listed, or correct the name in tasks.md.",
  },
  "OSW-TSK-011": {
    level: "error",
    text: "Invalid parameter for check \"{name}\" (\"{param}\"): {reason}",
    why: "A task's mechanical check declaration carries a parameter the check cannot take.",
    todo: "Correct the parameter in tasks.md as the reason says.",
  },
  "OSW-TSK-012": {
    level: "error",
    text: "path-unchanged requires a repository-relative path parameter",
    why: "A path-unchanged check was declared with no parameter, so it could never run.",
    todo: "Give the check a repository-relative path parameter.",
  },
  "OSW-TSK-013": {
    level: "error",
    text: "must be a repository-relative path, not absolute and not containing \"..\"",
    why: "A check parameter is absolute or traverses upward, so it cannot name a file inside the repository.",
    todo: "Use a path relative to the repository root and without \"..\".",
  },
  "OSW-TSK-014": {
    level: "error",
    text: "Task list for {change} has changed since it was last loaded — refresh and try again.",
    why: "tasks.md was rewritten between reading and writing, so a stale line would have been changed.",
    todo: "Refresh the task list and make the change again.",
  },
  "OSW-TSK-015": {
    level: "info",
    text: "a person",
    why: "An open item waits on a person rather than an agent.",
    todo: "Nothing: do the item when you reach it.",
  },
  "OSW-TSK-016": {
    level: "warning",
    text: "\"{agent}\", which is not a registered agent",
    why: "An item names an agent id the workspace's registry does not carry, so it only looks assigned.",
    todo: "Correct the id in the task text or in the change's taskAgents.",
  },
  "OSW-TSK-017": {
    level: "warning",
    text: "{waiting} (this change's harness.json names it; the task text names {textagent})",
    why: "The change's configuration and the task's own text name different agents for one item.",
    todo: "Settle which agent owns the item, in harness.json or in the task text.",
  },
  "OSW-TSK-018": {
    level: "warning",
    text: "{change} names {agent} for task {task}, but {where}",
    why: "A change's taskAgents key names an agent for a task that is gone or waits on a person.",
    todo: "Remove or correct the taskAgents key named.",
  },
  "OSW-TSK-019": {
    level: "info",
    text: "No active change to look at.{enrolments}",
    why: "The workspace holds no active change, so the inbox has nothing to read.",
    todo: "Open or create a change, or check the workspace root.",
  },
  "OSW-TSK-020": {
    level: "info",
    text: "Nothing is waiting — {changes} read.{stale}",
    why: "Active changes were read and none holds an item waiting on a person or an agent.",
    todo: "Nothing, unless a change that should be listed is missing from those read.",
  },
  "OSW-TSK-021": {
    level: "info",
    text: "{items} items waiting, across {changes} of {total} active changes: {waiting}.{stale}",
    why: "Open items wait across the workspace, some on a person and some on an agent.",
    todo: "Work the items, or hand the agents' items to an agent.",
  },
  "OSW-TSK-022": {
    level: "warning",
    text: "{count} harness.json could not be read, so their items are resolved from the task text alone: {listed}.",
    why: "A change's taskAgents configuration is unreadable, so its delegation is read from task text alone.",
    todo: "Fix the change's harness.json so its delegation is read.",
  },
  "OSW-TSK-023": {
    level: "warning",
    text: "1 key that signs a run waits to be enrolled.",
    why: "A key that signs a live run is not enrolled, so a person must confirm it was them.",
    todo: "Enrol the key from the change's card or the team surface.",
  },
  "OSW-TSK-024": {
    level: "warning",
    text: "{count} keys that sign runs wait to be enrolled.",
    why: "Keys that sign live runs are not enrolled, so a person must confirm each one.",
    todo: "Enrol the keys from the changes' cards or the team surface.",
  },
  "OSW-TSK-025": {
    level: "warning",
    text: "1 question from an agent waits for your answer.",
    why: "An agent's question holds a run until the operator answers it.",
    todo: "Answer the question on the change's card or in decisions.md.",
  },
  "OSW-TSK-026": {
    level: "warning",
    text: "{count} questions from agents wait for your answer.",
    why: "Agents' questions hold runs until the operator answers them.",
    todo: "Answer the questions on the changes' cards or in decisions.md.",
  },
  "OSW-TSK-027": {
    level: "warning",
    text: "{count} taskAgents entry(ies) matched no open task: {listed}.",
    why: "A change's taskAgents names agents for tasks that are not open, so the configuration has gone stale.",
    todo: "Remove or correct the taskAgents keys named.",
  },
  "OSW-TSK-028": {
    level: "error",
    text: "What is waiting could not be read: {reason}.",
    why: "The inbox read failed, so what is waiting is unknown rather than empty.",
    todo: "Read the reason, fix what it names, and reload the inbox.",
  },
  "OSW-TSK-029": {
    level: "error",
    text: "{ending} {item} came back ticked with nothing written, so the tick was reverted and the run is refused.",
    why: "A delegated run ticked its item while adding no evidence, so the rubber-stamp gate rolled the tick back.",
    todo: "Read the run's reply, write the evidence, then tick the item or run it again.",
  },
  "OSW-TSK-030": {
    level: "info",
    text: "{ending} {item} is ticked and its text carries more than it did. Something was recorded; whether it is true was not checked.",
    why: "A delegated run ticked its item and wrote something, which the narrow gate accepts without judging truth.",
    todo: "Read what was recorded and judge whether it is the evidence the task asked for.",
  },
  "OSW-TSK-031": {
    level: "warning",
    text: "{ending} {item} could not be found again afterwards, so nothing was compared: {reason}.",
    why: "The item moved or vanished after the run, so the gate reports that it could not compare rather than assuming.",
    todo: "Find the item and compare its text with what the run wrote.",
  },
  "OSW-TSK-032": {
    level: "warning",
    text: "{ending} {item} is still open.",
    why: "The delegated run ended without ticking the item it was asked to close.",
    todo: "Read the run's reply and close the item, or run it again.",
  },
  "OSW-TSK-033": {
    level: "warning",
    text: "no open task numbered {task} is left in {change}/tasks.md",
    why: "The task the gate compares by number is no longer open in tasks.md after the run.",
    todo: "Check whether the task was closed, renumbered or removed during the run.",
  },
  "OSW-TSK-034": {
    level: "warning",
    text: "line {line} of {change}/tasks.md is no longer a checklist item",
    why: "The item's line no longer holds a checklist item after the run.",
    todo: "Check what the run changed around that line.",
  },
  "OSW-TSK-035": {
    level: "error",
    text: "the item became ticked while saying nothing it did not say before",
    why: "The run ticked the item without writing any new evidence, so the gate reverts the tick.",
    todo: "Read the run's reply, write the evidence, and tick the item.",
  },
  "OSW-TSK-036": {
    level: "warning",
    text: "{reason}. It last said: {said}",
    why: "A failed or cancelled run ended for the given reason, and the end of its stderr is kept for the reader.",
    todo: "Read the last words and put right what stopped the run.",
  },
  "OSW-TSK-101": {
    level: "warning",
    text: "a request to stop after {task} named a task this change does not have; the run goes on",
    why: "The stop named a task number the change's task list does not contain, and that cannot be read as either \"stop now\" or \"never stop\".",
    todo: "Check the task number against tasks.md and ask the run to stop after a task it actually has.",
  },

  // VAL: validation, the merge gate, checks.
  "OSW-VAL-001": {
    level: "error",
    text: "\"path-unchanged\" requires a repository-relative path parameter",
    why: "The path-unchanged check was named in a task line without the repository-relative path it must watch.",
    todo: "Add the path after the check name, as in `path-unchanged: packages/core/src`.",
  },
  "OSW-VAL-002": {
    level: "error",
    text: "path \"{path}\" resolves outside the workspace \"{root}\"",
    why: "A path-unchanged parameter resolved outside the workspace, which a check must never reach.",
    todo: "Correct the path in the task line so that it stays inside the workspace.",
  },
  "OSW-VAL-003": {
    level: "error",
    text: "Unknown mechanical check \"{name}\" (expected one of: {names})",
    why: "A check name reached the runner that the closed registry does not contain, which is a host's fault rather than a person's.",
    todo: "Report it with the task line that named the check, since only the listed names may run.",
  },
  "OSW-VAL-004": {
    level: "error",
    text: "No change named {change}",
    why: "A relation edit named a change the workspace does not have.",
    todo: "Use the id of a change that exists, refreshing the Pipeline if the name came from a card.",
  },
  "OSW-VAL-005": {
    level: "error",
    text: "{change} is archived, and an archived change's relations are history",
    why: "A relation edit targeted an archived change, whose relations are fixed history.",
    todo: "Edit an active change's relations instead, or restore the change first.",
  },
  "OSW-VAL-006": {
    level: "error",
    text: "{path} cannot be read as relations: {error}",
    why: "The change's metadata holds relation lines that the reader cannot parse.",
    todo: "Fix the follows, supersedes or blocked_by lines in the file by hand, then try the edit again.",
  },
  "OSW-VAL-007": {
    level: "error",
    text: "The edit names no change to relate",
    why: "A relation edit arrived with neither a change to add nor one to remove.",
    todo: "Give the edit exactly one change to add or remove.",
  },
  "OSW-VAL-008": {
    level: "error",
    text: "A change cannot state {key} on itself",
    why: "A relation edit would make the change state a relation on itself.",
    todo: "Name a different change.",
  },
  "OSW-VAL-009": {
    level: "error",
    text: "No change named {change}, active or archived",
    why: "The change being added as a relation exists neither active nor archived.",
    todo: "Use the id of an existing change, or create that change first.",
  },
  "OSW-VAL-010": {
    level: "error",
    text: "That would close a cycle: {cycle}",
    why: "The added relation would make the change graph circular, which the relation gate refuses.",
    todo: "Choose a relation that keeps the graph acyclic, following the named path.",
  },
  "OSW-VAL-101": {
    level: "error",
    text: "openspec change validate --strict {change}: {count} item(s) failed ({ids})",
    why: "Strict OpenSpec validation of the change found items that do not hold.",
    todo: "Fix the items named, then run the check again.",
  },
  "OSW-VAL-102": {
    level: "info",
    text: "openspec change validate --strict {change}: {count} item(s) passed",
    why: "Strict OpenSpec validation of the change passed every item.",
    todo: "Nothing.",
  },
  "OSW-VAL-103": {
    level: "error",
    text: "openspec change validate --strict {change} failed to run: {error}",
    why: "The strict validation command could not be started or threw.",
    todo: "Fix the reported tooling problem, then run the check again.",
  },
  "OSW-VAL-104": {
    level: "error",
    text: "npm run {script} failed to run: {error}",
    why: "An npm script that the check runs could not be started.",
    todo: "Fix the reported npm or script problem, then run the check again.",
  },
  "OSW-VAL-105": {
    level: "info",
    text: "npm run {script} exited 0",
    why: "The npm script that the check runs finished successfully.",
    todo: "Nothing.",
  },
  "OSW-VAL-106": {
    level: "error",
    text: "npm run {script} exited {code}:\n{output}",
    why: "The npm script that the check runs finished with a non-zero exit code.",
    todo: "Read the output shown, fix what failed, then run the check again.",
  },
  "OSW-VAL-107": {
    level: "error",
    text: "git diff -- {path} failed to run: {error}",
    why: "The git command behind the path-unchanged check could not be started.",
    todo: "Fix the reported git or filesystem problem, then run the check again.",
  },
  "OSW-VAL-108": {
    level: "info",
    text: "git diff -- {path} reported no changes",
    why: "The watched path has no uncommitted changes, so the path-unchanged check passed.",
    todo: "Nothing.",
  },
  "OSW-VAL-109": {
    level: "error",
    text: "git diff -- {path} reported uncommitted changes to \"{path}\"",
    why: "The path that the check must leave unchanged has uncommitted changes.",
    todo: "Commit, revert or move the changes at the named path.",
  },
  "OSW-VAL-110": {
    level: "error",
    text: "git diff -- {path} exited {code}: {output}",
    why: "The git command behind the path-unchanged check exited with an unexpected code.",
    todo: "Read the output shown, fix what git reported, then run the check again.",
  },
  "OSW-VAL-111": {
    level: "error",
    text: "no \".changeset/config.json\" found under \"{root}\" — Changesets is not adopted",
    why: "The changeset-present check ran where Changesets is not adopted.",
    todo: "Adopt Changesets in the workspace, or remove that check from the task line.",
  },
  "OSW-VAL-112": {
    level: "error",
    text: "no pending \".changeset/*.md\" file found — run \"npx changeset\" for \"{change}\"",
    why: "The change has no pending changeset file, which the merge gate requires.",
    todo: "Run `npx changeset` and commit the file it writes.",
  },
  "OSW-VAL-113": {
    level: "info",
    text: "{count} pending changeset file(s) found",
    why: "The changeset-present check found the pending files it requires.",
    todo: "Nothing.",
  },
  "OSW-VAL-114": {
    level: "error",
    text: "requirement header \"{header}\" does not exist in the current specification",
    why: "A modified block names a requirement that the current specification no longer carries.",
    todo: "Update the change's modified block to the header the current specification carries.",
  },
  "OSW-VAL-115": {
    level: "error",
    text: "scenario \"{scenario}\" under requirement \"{header}\" exists in the current specification but is omitted from this change's modified block",
    why: "The current specification has a scenario that the change's modified block omits.",
    todo: "Add the scenario to the modified block, or remove it from the specification.",
  },
  "OSW-VAL-116": {
    level: "error",
    text: "{change}'s tasks.md names \"Successor created: `{successor}`\" but no change `{successor}` states `follows: {change}`",
    why: "A change's tasks.md promised a named successor that no change of that id follows.",
    todo: "Create the successor with the relation stated, or correct the claim in tasks.md.",
  },
  "OSW-VAL-117": {
    level: "info",
    text: "Nothing recorded yet — no runs have been logged in this workspace.",
    why: "The audit log has no entries, so there is no verify quality to report.",
    todo: "Nothing.",
  },
  "OSW-VAL-118": {
    level: "info",
    text: "Nothing to report yet — {runs} runs recorded, none of which reached a verifying stage that reported what its checks found.",
    why: "Runs are recorded, but none reached a verify stage that reported what its checks found.",
    todo: "Nothing.",
  },
  "OSW-VAL-119": {
    level: "info",
    text: "{stages} verifying stage(s) recorded, none of which names the agent whose work was checked. They were recorded before that was written down, so none is charged to an agent.",
    why: "The verify stages were recorded before the field naming the checked agent existed, so none is charged to an agent.",
    todo: "Nothing, newer verifies record the agent whose work was checked.",
  },
  "OSW-VAL-120": {
    level: "info",
    text: "{stages} verifying stage(s) across {agents} checked agent(s){thinClause}{unnamedClause}",
    why: "The verifying stages and their failures are reported per checked agent, with thin groups and unattributed entries named.",
    todo: "Read the rows, and gather more verifies before trusting a thin group's rate.",
  },
  "OSW-VAL-121": {
    level: "error",
    text: "mechanical checks failed, verifying agent was not invoked: {summary}",
    why: "A declared mechanical check failed at verify, and the chain deliberately spends no verifying run to learn what an exit code already said.",
    todo: "Put right what the named checks reported (or finish the tasks they uncheck), then run the change again.",
  },

  // ARC: archiving.
  "OSW-ARC-001": {
    level: "error",
    text: "initOpenSpec requires at least one tool",
    why: "`initOpenSpec` was called with a tools list that held no usable name.",
    todo: "Pass at least one tool name, or skip initialization.",
  },
  "OSW-ARC-002": {
    level: "error",
    text: "OpenSpec CLI returned {kind} JSON for '{command}'. Expected {contract}. Update OpenSpec CLI or OpenSpec Workbench to compatible versions.",
    why: "The `openspec` CLI answered a command with JSON this Workbench cannot read.",
    todo: "Update the OpenSpec CLI or OpenSpec Workbench so their versions agree.",
  },
  "OSW-ARC-003": {
    level: "error",
    text: "{binary} {args} exited with code {code}: {reason}",
    why: "The `openspec` command exited non-zero, and its own diagnosis is quoted after the code.",
    todo: "Read the diagnosis and put right what it names, then retry.",
  },
  "OSW-ARC-004": {
    level: "error",
    text: "could not archive \"{change}\": it still owes {debts}",
    why: "Archiving is refused unless every task item is closed and anything closed has something written under it (a-change-is-archived-with-nothing-open).",
    todo: "Finish the named tasks, writing a note under each closed one, then archive again.",
  },
  "OSW-ARC-005": {
    level: "error",
    text: "the archive did not happen, and no reason was given",
    why: "The archive result carried neither an archived change nor any status entries to explain it.",
    todo: "Run `openspec archive` by hand to see what it says.",
  },
  "OSW-ARC-006": {
    level: "error",
    text: "the archive did not happen, and the report gave no reason",
    why: "The archive's status entries held no error message or code that could be reported.",
    todo: "Run `openspec archive` by hand to see what it says.",
  },
  "OSW-ARC-007": {
    level: "error",
    text: "could not archive \"{change}\": {refusal}",
    why: "The archive subcommand refused, and its reasons and remedies are reported together.",
    todo: "Do what the refusal's reason and fix say, then archive the change again.",
  },
  "OSW-ARC-101": {
    level: "error",
    text: "archiving changed nothing, so there was nothing to commit",
    why: "After archiving, git had staged nothing, so the branch would carry no archive.",
    todo: "Find why the archive changed no file, then run the sweep again.",
  },
  "OSW-ARC-102": {
    level: "error",
    text: "{forge} could not be asked about pull requests: {reason}",
    why: "The forge could not be asked about pull requests, so the pass cannot know what is due or already open.",
    todo: "Fix the forge access the reason names, then sweep again.",
  },
  "OSW-ARC-103": {
    level: "warning",
    text: "its checks could not be read: {reason}",
    why: "An open archive pull request's checks could not be read, so it cannot be merged yet.",
    todo: "Nothing; the next pass reads them again.",
  },
  "OSW-ARC-104": {
    level: "warning",
    text: "a check failed",
    why: "A check on the archive pull request failed, so the sweep will not merge it.",
    todo: "Read the failed check and fix or re-run it.",
  },
  "OSW-ARC-105": {
    level: "error",
    text: "no merge method was tried",
    why: "No merge method was available to try, so the archive pull request was left unmerged.",
    todo: "Report it; a merge method should always be tried.",
  },
  "OSW-ARC-106": {
    level: "error",
    text: "{forge} refused the merge: {reason}",
    why: "The forge refused every merge method tried for the archive pull request.",
    todo: "Read the forge's reason and put right what it names, then wait for the next pass.",
  },
  "OSW-ARC-107": {
    level: "error",
    text: "{reason}; making it again on {ref} failed too: {failure}",
    why: "The forge refused the merge and the rebuilt archive could not be pushed to its branch either.",
    todo: "Fix what the second failure names, then sweep again.",
  },
  "OSW-ARC-108": {
    level: "error",
    text: "no reason given",
    why: "A failure carried no message or telling git line that could be quoted.",
    todo: "Run the command by hand to see why it failed.",
  },
  "OSW-ARC-201": {
    level: "info",
    text: "opened #{number} to archive {changes}, which landed with nothing open",
    why: "The sweep found changes that landed with every task closed, and opened one pull request to archive them.",
    todo: "Nothing; the sweep follows it and merges it once its checks pass.",
  },
  "OSW-ARC-202": {
    level: "info",
    text: "#{number} is merged by the sweep once its checks pass",
    why: "The sweep merges the archive pull request itself rather than asking the forge to do it later.",
    todo: "Nothing; wait for the checks.",
  },
  "OSW-ARC-203": {
    level: "info",
    text: "merged #{number} by {method}: its checks passed, or none ran",
    why: "The archive pull request's checks had decided, or none ran, so the sweep merged it.",
    todo: "Nothing.",
  },
  "OSW-ARC-204": {
    level: "info",
    text: "#{number} is waiting for its checks",
    why: "The archive pull request's checks are still running.",
    todo: "Nothing; the next pass reads them again.",
  },
  "OSW-ARC-205": {
    level: "warning",
    text: "#{number} was refused while {behind} {commits} behind the default branch, so the archive was made again on it and pushed; its checks run again",
    why: "A forge that merges only what is up to date refused the branch, so the archive was rebuilt on the default branch.",
    todo: "Nothing; wait for the new checks.",
  },
  "OSW-ARC-206": {
    level: "warning",
    text: "#{number} cannot merge yet: {reason}",
    why: "The archive pull request is blocked, usually by a failed check or the forge's refusal.",
    todo: "Read the reason and put right what it names.",
  },
  "OSW-ARC-207": {
    level: "warning",
    text: "could not archive {change}: {reason}",
    why: "One change's archive failed while the pass was making the archive.",
    todo: "Read the reason and archive that change again.",
  },
  "OSW-ARC-208": {
    level: "error",
    text: "{change} landed in #{number} but still owes {owed}, so it stays live: {owes}",
    why: "A change landed while its task list still owed something, which the merge gate should have prevented.",
    todo: "Report it, then close the named tasks or reopen the change.",
  },
  "OSW-ARC-209": {
    level: "error",
    text: "nothing was archived: {failed}",
    why: "The pass could not make an archive pull request at all.",
    todo: "Read the reason and fix what it names, then sweep again.",
  },

  // WSP: the workspace: setup, lease, locks.
  "OSW-WSP-001": {
    level: "error",
    text: "Another OpenSpec Workbench host ({hostKind} on {hostname}, pid {pid}{author}, last active {seconds}s ago) is currently running a mutating operation on this workspace. Wait for it to finish, or close it, before starting one here.",
    why: "A live foreign host holds this workspace's lease, and only one mutating operation may run against a workspace at a time (ADR 0010).",
    todo: "Wait for the named host to finish or close it, then start the operation again.",
  },
  "OSW-WSP-002": {
    level: "error",
    text: "the holder is on {holderhostname} and this is {thishostname}, so whether its process is still running cannot be checked from here. Clear it there, or wait for its lease to go stale.",
    why: "A lease held on another machine cannot be shown to be dead from this one, so clearing it here could rob a running holder.",
    todo: "Clear the lease on the machine named, or wait for its heartbeat to go stale.",
  },
  "OSW-WSP-003": {
    level: "error",
    text: "process {pid} is still running. Taking its lease would let a second mutating run start against files it still has open, which is what the lease prevents — stop that process instead.",
    why: "The holder's process is still alive on this machine, so releasing its lease would let two mutating runs touch the same files.",
    todo: "Stop the process named, or wait for it to end, then clear the lease.",
  },
  "OSW-WSP-004": {
    level: "warning",
    text: "\"{name}\" is not a valid change name",
    why: "A working directory was asked for a change whose name no change may have, so no branch or directory of that name can be made.",
    todo: "Name the change as its folder under openspec/changes is named.",
  },
  "OSW-WSP-005": {
    level: "warning",
    text: "\"{name}\" is not in {base}",
    why: "The change exists only as uncommitted files, and the working directory is cut from a base that does not contain it.",
    todo: "Commit the change's directory to the base first, or name a base that has it.",
  },
  "OSW-WSP-006": {
    level: "warning",
    text: "branch \"{name}\" is already checked out at {path}",
    why: "A branch can be checked out in only one working directory, and this change's branch already has one.",
    todo: "Run the chain in that directory, or remove it first.",
  },
  "OSW-WSP-007": {
    level: "warning",
    text: "{path} already exists",
    why: "The place a working directory would be created is already occupied, so creating it would touch something this product did not make.",
    todo: "Remove it, or pass another path.",
  },
  "OSW-WSP-008": {
    level: "warning",
    text: "branch \"{name}\" already exists, with no working directory on it",
    why: "Removing a working directory leaves its branch behind, and git would otherwise refuse with a reason that says nothing about what to do.",
    todo: "Check the branch out where it is wanted, or delete it if its work has landed.",
  },
  "OSW-WSP-009": {
    level: "warning",
    text: "the working tree is not clean",
    why: "A directory whose tree is dirty may still hold uncommitted work, and removing it has no undo.",
    todo: "Commit or discard the uncommitted changes, then ask for the removal again.",
  },
  "OSW-WSP-101": {
    level: "info",
    text: "Reclaimed the workspace lease from {hostKind} on {hostname} (pid {pid}), which stopped renewing it {seconds}s ago.",
    why: "A previous holder stopped heartbeating, so this run took the workspace from it rather than waiting forever.",
    todo: "Nothing, unless that holder was expected to be alive: a reap of a live holder's lease is the one case worth checking by hand.",
  },
  "OSW-WSP-102": {
    level: "warning",
    text: "it is not a directory",
    why: "A path the repository lists as a working directory is not a directory, so its changes, task lists and lease cannot be read.",
    todo: "Look at the path the worktree list names, and repair or prune it.",
  },
  "OSW-WSP-103": {
    level: "warning",
    text: "it does not exist",
    why: "A worktree the repository lists has no directory at its path, so nothing of it can be surveyed.",
    todo: "Run `git worktree prune`, or restore the missing directory.",
  },
  "OSW-WSP-104": {
    level: "error",
    text: "{said}. No process names this directory on its command line; one that holds it without naming it is not found this way.",
    why: "A removal failed and no process naming the directory was found, so the underlying reason is all that can be said.",
    todo: "Look for a program holding the directory without naming it on its command line, then remove it again.",
  },
  "OSW-WSP-105": {
    level: "error",
    text: "{said}. Held by {holders}, by their command lines.",
    why: "A removal failed and processes whose command lines name the directory were found, so the message says who may be holding it.",
    todo: "Stop the processes named, then remove the directory again.",
  },

  // KEY: signatures, keys, the team.
  "OSW-KEY-001": {
    level: "error",
    text: "Agent \"{agent}\" is not present in the workspace allowlist",
    why: "The workspace allowlist names no rule for this agent, so nothing it asks to run is permitted.",
    todo: "Add the agent to the workspace allowlist, or choose an agent that is already on it.",
  },
  "OSW-KEY-002": {
    level: "error",
    text: "Agent \"{agent}\" is not permitted to run in process",
    why: "The agent's allowlist rules carry no in-process rule matching its own name.",
    todo: "Add an in-process rule for the agent, or run it as a spawned executable.",
  },
  "OSW-KEY-003": {
    level: "error",
    text: "HTTP call is not permitted by the allowlist for agent \"{agent}\"",
    why: "The agent's rules carry no HTTP rule, so the call it asked for cannot be made.",
    todo: "Add an HTTP rule for the agent, or use an agent that reaches the model another way.",
  },
  "OSW-KEY-004": {
    level: "error",
    text: "URL/method \"{method} {url}\" is not permitted by the allowlist",
    why: "The agent's HTTP rule allows other URLs or methods than the one this call names.",
    todo: "Extend the rule to the URL and method, or change the call.",
  },
  "OSW-KEY-005": {
    level: "error",
    text: "Executable \"{executable}\" is not permitted by the allowlist for agent \"{agent}\"",
    why: "The agent asked to spawn an executable that no rule of its allowlist names.",
    todo: "Add the executable to the agent's rules, or have it use one already permitted.",
  },
  "OSW-KEY-006": {
    level: "error",
    text: "Arguments [{arguments}] are not permitted by the allowlist",
    why: "The executable is permitted, but its rules refuse the arguments this invocation carries.",
    todo: "Bring the invocation within the rule's arguments, or widen the rule.",
  },
  "OSW-KEY-007": {
    level: "error",
    text: "cwd \"{cwd}\" is outside the workspace \"{workspace}\"",
    why: "The run's working directory resolved outside the workspace root, and the cwd sandbox refuses it.",
    todo: "Run from a directory inside the workspace.",
  },
  "OSW-KEY-008": {
    level: "error",
    text: "it is not valid JSON",
    why: "A person's file could not be parsed, so nothing in it can be trusted.",
    todo: "Fix the file's JSON, then read the team again.",
  },
  "OSW-KEY-009": {
    level: "error",
    text: "it is not a JSON object",
    why: "A person's file parses to something other than an object with named fields.",
    todo: "Make the file a JSON object with handle, name and keys.",
  },
  "OSW-KEY-010": {
    level: "error",
    text: "its handle is missing or not lower-case letters, digits and single hyphens",
    why: "A person is named by a handle a forge would accept, and this file's handle is not that shape.",
    todo: "Give the file a handle of lower-case letters, digits and single hyphens.",
  },
  "OSW-KEY-011": {
    level: "error",
    text: "its file is not named after its handle ({handle}.json)",
    why: "The file name must be the handle, so that two files cannot claim one handle.",
    todo: "Rename the file to the handle it declares.",
  },
  "OSW-KEY-012": {
    level: "error",
    text: "it has no name",
    why: "Every person is shown by a name, and this file leaves it empty.",
    todo: "Add the person's name to the file.",
  },
  "OSW-KEY-013": {
    level: "error",
    text: "it lists no key",
    why: "A person with no key can sign nothing, so their file is unusable.",
    todo: "Add at least one public key to the file.",
  },
  "OSW-KEY-014": {
    level: "error",
    text: "{key} is not a JSON object",
    why: "One entry in the keys list is not an object with a key id, public key and added date.",
    todo: "Make that key entry a JSON object.",
  },
  "OSW-KEY-015": {
    level: "error",
    text: "{key} is not an Ed25519 public key with its key id",
    why: "The entry's public key and key id do not match, so signatures made with it cannot be verified.",
    todo: "Re-add the key from the machine that holds it.",
  },
  "OSW-KEY-016": {
    level: "error",
    text: "{key} has no date it was added",
    why: "Every key records when it was added, and this one has no readable date.",
    todo: "Give the key an addedAt date in ISO form.",
  },
  "OSW-KEY-017": {
    level: "error",
    text: "{key} has a retirement date that is not a date",
    why: "A retirement date is only read as an ISO date, and this one is not one.",
    todo: "Correct the retiredAt date, or remove it.",
  },
  "OSW-KEY-018": {
    level: "error",
    text: "{key} names its machine with something other than text",
    why: "The optional machine field must be text a person can read.",
    todo: "Make the machine field text, or remove it.",
  },
  "OSW-KEY-019": {
    level: "error",
    text: "its e-mail addresses are not a list of addresses",
    why: "The optional emails field must be a list of strings that each look like an address.",
    todo: "Correct the e-mail list, or remove the field.",
  },
  "OSW-KEY-020": {
    level: "error",
    text: "key {keyId} is also {handle}'s",
    why: "One key id appears in two people's files, so either could sign as the other.",
    todo: "Remove the duplicate key from one file and give that person their own.",
  },
  "OSW-KEY-021": {
    level: "error",
    text: "a person is never removed: their signatures would stop verifying",
    why: "A pull request that deletes a person's file would leave everything they signed unverifiable.",
    todo: "Keep the file and retire the keys that are no longer used.",
  },
  "OSW-KEY-022": {
    level: "error",
    text: "key {keyId} was removed; retire it with retiredAt instead",
    why: "A key is never taken out of a person's file, because what it signed must keep verifying.",
    todo: "Put the key back and set its retiredAt date.",
  },
  "OSW-KEY-023": {
    level: "error",
    text: "key {keyId} was replaced",
    why: "Changing a recorded public key would make everything it signed fail to verify.",
    todo: "Restore the original key and add the new one alongside it.",
  },
  "OSW-KEY-024": {
    level: "error",
    text: "key {keyId}'s retirement was changed",
    why: "A retirement already recorded is history, and changing it rewrites when a key stopped being used.",
    todo: "Restore the recorded retirement date.",
  },
  "OSW-KEY-025": {
    level: "error",
    text: "\"{handle}\" is not a handle: use lower-case letters, digits and single hyphens",
    why: "Joining the team takes a handle of the shape a forge accepts, and this one is not that shape.",
    todo: "Choose a handle of lower-case letters, digits and single hyphens.",
  },
  "OSW-KEY-026": {
    level: "error",
    text: "a name is needed",
    why: "A person joins under a name others can read, and none was given.",
    todo: "Pass the name along with the handle.",
  },
  "OSW-KEY-027": {
    level: "error",
    text: "this machine's key is already {handle}'s",
    why: "This machine's key can belong to only one person, and it is already in another's file.",
    todo: "Join under that handle, or make a new key for this person.",
  },
  "OSW-KEY-028": {
    level: "error",
    text: "{file} cannot be read: {problems}",
    why: "The person's existing file has problems, so this machine's key cannot be added to it.",
    todo: "Fix the problems listed in that file, then join again.",
  },
  "OSW-KEY-029": {
    level: "error",
    text: "no live run signed by {keyId} is waiting to be enrolled",
    why: "Confirmation enrols only a key that signs a live record now, so a confirmation is always about a run somebody can see.",
    todo: "Enrol a key id that a live run's record is signed with.",
  },
  "OSW-KEY-030": {
    level: "error",
    text: "the key at {file} is not an Ed25519 key",
    why: "The private key file holds a key of another type, which this product does not sign with.",
    todo: "Remove or move the file so that a fresh Ed25519 key is made.",
  },
  "OSW-KEY-031": {
    level: "error",
    text: "the key at {file} was removed as it was made",
    why: "Two writers made a key at once and the private file vanished before it could be read.",
    todo: "Try again; report it if the key file keeps disappearing.",
  },

  // NET: network, proxy, the local LLM.
  "OSW-NET-001": {
    level: "warning",
    text: "{token} is not set",
    why: "The forge's token was not in the environment, so the forge cannot be reached.",
    todo: "Set the named token in the environment, then read the pull requests again.",
  },
  "OSW-NET-002": {
    level: "error",
    text: "the {token} was refused (401)",
    why: "The forge answered the token with 401, so the credentials are wrong or expired.",
    todo: "Replace the named token, then read the pull requests again.",
  },
  "OSW-NET-003": {
    level: "error",
    text: "{method} {path} answered {status}: {reason}",
    why: "The forge refused the request and said why in its own words.",
    todo: "Read the forge's reason and put right what it names, then try again.",
  },
  "OSW-NET-004": {
    level: "warning",
    text: "gh is not installed",
    why: "`gh` is not on PATH, so GitHub cannot be read through it.",
    todo: "Install `gh`, or set GITHUB_TOKEN to reach GitHub over its API.",
  },
  "OSW-NET-005": {
    level: "warning",
    text: "no remote is on a GitHub host gh knows",
    why: "`gh` was asked about a repository whose remote it cannot place on GitHub.",
    todo: "Point `origin` at a GitHub host `gh` knows, or set GITHUB_TOKEN.",
  },
  "OSW-NET-006": {
    level: "warning",
    text: "gh is not signed in",
    why: "`gh` has no credentials for this host, so it answered with an auth error.",
    todo: "Run `gh auth login`, or set GITHUB_TOKEN.",
  },
  "OSW-NET-007": {
    level: "warning",
    text: "{reason}, and GITHUB_TOKEN is not set",
    why: "`gh` could not reach GitHub and no API token was set either.",
    todo: "Install or sign in to `gh`, or set GITHUB_TOKEN.",
  },
  "OSW-NET-008": {
    level: "error",
    text: "gh failed: {reason}",
    why: "`gh` exited non-zero and gave a reason of its own.",
    todo: "Read what `gh` said and put it right, then read the pull requests again.",
  },
  "OSW-NET-009": {
    level: "error",
    text: "gh printed something that is not JSON",
    why: "`gh` answered the pull-request list with output the product cannot parse.",
    todo: "Check the installed `gh` version and report the output if it persists.",
  },
  "OSW-NET-010": {
    level: "error",
    text: "gh printed something that is not a list",
    why: "`gh` answered the pull-request list with JSON that is not a list.",
    todo: "Check the installed `gh` version and report the output if it persists.",
  },
  "OSW-NET-101": {
    level: "info",
    text: "checks are still pending",
    why: "At least one check has not finished, so the answer is not final yet.",
    todo: "Wait; the product asks again until the checks decide.",
  },
  "OSW-NET-102": {
    level: "warning",
    text: "no check result was available",
    why: "The forge reported no checks, so nothing vouches for the change.",
    todo: "Add a check, or merge by hand once you are satisfied.",
  },
  "OSW-NET-103": {
    level: "error",
    text: "check failed: {check} ({state})",
    why: "One check finished in a state that is neither a pass nor pending.",
    todo: "Read that check's log and put right what it reports.",
  },
  "OSW-NET-104": {
    level: "warning",
    text: "every check was skipped — no check actually ran",
    why: "Checks exist but none of them decided anything, which ADR 0014 treats as no evidence.",
    todo: "Run a check that actually exercises the change, then try again.",
  },
  "OSW-NET-105": {
    level: "warning",
    text: "Gitea did not say which commit the pull request is at",
    why: "Gitea's answer carried no head commit, so its checks cannot be read.",
    todo: "Check the pull request in Gitea, then try again.",
  },
  "OSW-NET-106": {
    level: "warning",
    text: "GitHub did not say which commit the pull request is at",
    why: "GitHub's answer carried no head commit, so its checks cannot be read.",
    todo: "Check the pull request on GitHub, then try again.",
  },
  "OSW-NET-201": {
    level: "warning",
    text: "checks did not reach a terminal state before timeout",
    why: "The checks were still pending when the wait ran out.",
    todo: "Look at why the checks are slow, or raise maxWaitMs.",
  },
  "OSW-NET-202": {
    level: "warning",
    text: "Stopped at the {calls}-web-tool-call limit.",
    why: "The local model asked for more web-tool calls than the product allows.",
    todo: "Raise the web-tool-call limit, or narrow the request.",
  },
  "OSW-NET-203": {
    level: "warning",
    text: "Stopped at the {iterations}-iteration web-tool limit.",
    why: "The local model used every web-tool iteration the product allows.",
    todo: "Raise the web-tool-iteration limit, or narrow the request.",
  },
  "OSW-NET-204": {
    level: "info",
    text: "The local LLM's server refused the key. Set the key the server expects (the local LLM settings, or OPENSPEC_UI_LOCAL_LLM_API_KEY), then start the run again.",
    why: "The local LLM's server refused the key the run offered it.",
    todo: "Set the key the server expects in the local LLM settings or OPENSPEC_UI_LOCAL_LLM_API_KEY, then start the run again.",
  },
  "OSW-NET-205": {
    level: "info",
    text: "The agent could not reach its service. Check the address and the connection. Where a system proxy is in the way, turn on openspec-ui.agents.ignoreSystemProxy in the editor, or set OPENSPEC_UI_IGNORE_SYSTEM_PROXY=1 for the server and the CLI.",
    why: "The agent could not reach its service, and a system proxy is a common cause.",
    todo: "Check the address and the connection; where a proxy is in the way, turn on the ignore-system-proxy setting.",
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
