# Messages

<!-- Generated from packages/core/src/message-register.ts by
     `npm run messages --workspace @openspec-ui/core`. Do not edit. -->

Everything OpenSpec Workbench says to a person is said under an
identifier, `OSW-<GROUP>-<NNN>` (ADR 0046): `error OSW-RUN-104: ...`.
Search this page for the identifier you saw. Within a group the hundreds
say when a message is said: 0xx before anything runs, 1xx while it runs,
2xx as it ends. An identifier is never given to another message.

## CHG: a change: finding, creating, deleting it, where it lives

### OSW-CHG-001

> warning: "{name}" is not a change name this workspace can have.

Why: A card or a request named a change by something no change can be called.

What to do: Refresh the Pipeline; report it if a card shows that name.

### OSW-CHG-002

> info: {name} is neither an active change of this checkout nor worked in a directory of its own - it may have been archived or deleted since the Pipeline was read.

Why: The change a card names is no longer where the card was read from.

What to do: Refresh the Pipeline.

### OSW-CHG-003

> info: {action} {name}: {reason}

Why: The action cannot run now, for the reason given (ADR 0044).

What to do: Do what the reason says, then choose the action again.

## RUN: runs, chains, stages, checkpoints, limits

### OSW-RUN-001

> error: failed to resolve change name from command.context.changeDir

Why: The chain was started with a change directory it could not name - a host's fault, not a person's.

What to do: Report it, with the host and how the run was started.

### OSW-RUN-002

> error: this change's Agentic Harness autonomyLevel is "assisted" — start each stage individually instead of running a chain

Why: Under `autonomyLevel: "assisted"` a person starts every stage; a chain runs them one after another.

What to do: Start the stages one at a time, or raise the change's autonomyLevel to "semi-autonomous".

### OSW-RUN-003

> error: autonomyLevel "autonomous" is only reachable when this change's own openspec/changes/{change}/harness.json sets it directly — it is not settable globally, and inheriting it from elsewhere is refused

Why: A run without a person in it is chosen for one change at a time, in that change's own file.

What to do: Set `autonomyLevel: "autonomous"` in the change's harness.json, or run it at a lower level.

### OSW-RUN-004

> error: HarnessChainRunner.run only accepts "chain" commands, got "{kind}"

Why: A host sent the chain runner a command it does not run - a host's fault, not a person's.

What to do: Report it, with the host and how the run was started.

### OSW-RUN-005

> error: will not run "{change}": {reason}

Why: Something the run depends on is not so: the reason says what.

What to do: Do what the reason says, then run the change again.

### OSW-RUN-006

> info: the setting that governs this is {setting}

Why: The refusal above comes from a setting, and this names it.

What to do: Change that setting if the refusal is not what you want.

### OSW-RUN-101

> error: verification left {count} task(s) unchecked, and this chain did not run "apply" to send them back to: {tasks}

Why: "verify" found work unfinished, and there is no "apply" in this chain to finish it.

What to do: Finish the tasks named, or run the change from "apply".

### OSW-RUN-102

> error: verification left {count} task(s) unchecked after "apply" used all {attempts} of its attempts: {tasks}

Why: "verify" sent the work back to "apply" as often as maxStageAttempts allows, and it is still unfinished.

What to do: Read the runs' replies and finish the tasks named, or raise maxStageAttempts.

### OSW-RUN-103

> warning: "apply" changed {count} file(s) and ticked no task in tasks.md

Why: The implementing run changed files but marked no task done, so nothing says which work it finished.

What to do: Look at what it changed, and tick the tasks it finished.

### OSW-RUN-104

> error: "apply" changed no file and ticked no task, and {count} task(s) it could do are still open ({tasks}); the chain stops here rather than verify and archive work that was not done. Read the run's reply and the questions it asked, then start the change again

Why: The implementing run did nothing while work of its own was open; verifying and archiving after it would spend runs on work that was not done.

What to do: Read the run's reply and the questions it asked, answer them, then start the change again.

### OSW-RUN-201

> error: budget exceeded: recorded cost ${spent} for this change has reached the configured ceiling (${ceiling}) — stopping before the next stage, not because a stage failed

Why: The change's recorded cost has reached `budget.maxCostUsd`.

What to do: Raise the ceiling in the change's harness settings, or finish the change by hand.

### OSW-RUN-202

> error: budget exceeded: recorded tokens ({spent}) for this change have reached the configured ceiling ({ceiling}) — stopping before the next stage, not because a stage failed

Why: The change's recorded tokens have reached `budget.maxTokens`.

What to do: Raise the ceiling in the change's harness settings, or finish the change by hand.

### OSW-RUN-203

> error: budget exceeded: recorded cost {spent} {unit} for this change has reached the configured ceiling ({ceiling} {unit}) — stopping before the next stage, not because a stage failed

Why: The change's recorded cost in this unit has reached its ceiling in `budget.maxCost`.

What to do: Raise the ceiling in the change's harness settings, or finish the change by hand.

### OSW-RUN-204

> error: stopped after "{stage}": it reported ${spent}, over budget.maxStageCostUsd of ${ceiling}

Why: One stage cost more than `budget.maxStageCostUsd`.

What to do: Look at what the stage did, then raise the ceiling or start the change again.

### OSW-RUN-205

> error: stopped after "{stage}": it reported {spent} tokens, over budget.maxStageTokens of {ceiling}

Why: One stage used more tokens than `budget.maxStageTokens`.

What to do: Look at what the stage did, then raise the ceiling or start the change again.

### OSW-RUN-206

> warning: stopped at the run time limit: timeout.maxRunSeconds is {seconds}s, and this chain's stages had spent {spent} before "{stage}" could start

Why: The chain's time was spent before the next stage began.

What to do: Raise `timeout.maxRunSeconds`, or start the change again to go on from where it stopped.

### OSW-RUN-207

> warning: stopped at the run time limit: timeout.maxRunSeconds is {seconds}s, and this chain's stages had already spent {spent} before "{stage}" started

Why: The chain's time ran out while a stage was working.

What to do: Raise `timeout.maxRunSeconds`, or start the change again to go on from where it stopped.

### OSW-RUN-208

> warning: stopped "{stage}" at the stage time limit: timeout.maxStageSeconds is {seconds}s

Why: A stage worked longer than `timeout.maxStageSeconds`.

What to do: Raise the limit, or look at why the stage took so long.

### OSW-RUN-209

> warning: stopped "{stage}" after {attempts} attempt(s), the maximum configured (maxStageAttempts: {max}); the last ended because it was {reason}

Why: Every attempt the change allows the stage was cut by a limit.

What to do: Raise the limit that cut it, or maxStageAttempts.

### OSW-RUN-210

> info: cancelling; press Ctrl-C again to exit at once

Why: Ctrl-C asks the agent to stop, and the CLI waits for it to.

What to do: Wait, or press Ctrl-C again to leave without waiting.

### OSW-RUN-211

> warning: interrupted again — exiting without waiting for the agent to stop

Why: A second Ctrl-C leaves at once.

What to do: Check with `openspec-ui-cli show status` that the agent's process has gone.

### OSW-RUN-212

> error: the run ended without reporting an outcome

Why: The run's events ended with neither completed, failed nor cancelled.

What to do: Read the run's output above; report it if nothing there explains it.

## QST: questions to the operator

### OSW-QST-001

> error: {change} has {open} for the operator: {question} "{text}". Answer {them} first - on the change's card, with `openspec-ui-cli answer question {change} {question} "&lt;answer>"`, or in its decisions.md.

Why: An agent asked the operator something, and a new run would go on without the answer.

What to do: Answer the question, on the card, with the command shown, or in decisions.md.

### OSW-QST-002

> error: {question} was already answered; the first answer stands

Why: A question takes one answer.

What to do: Nothing: the run goes on with the first. Write to decisions.md if it must change.

### OSW-QST-003

> error: {question} is not a question of {change}

Why: No question with that id is in the change's decisions.md.

What to do: Run `openspec-ui-cli show questions <change>` for the ids.

### OSW-QST-101

> info: waiting for the operator's answer to {questions}

Why: The agent asked, and its run waits for the answer.

What to do: Answer on the change's card, with `openspec-ui-cli answer question`, or in decisions.md.

### OSW-QST-102

> info: answered; going on as {kind}

Why: Every question the run waited on is answered.

What to do: Nothing.

### OSW-QST-201

> warning: cancelled while waiting for the operator's answer; the questions stay open in decisions.md

Why: The run was cancelled before its questions were answered.

What to do: Answer them, then start the change again.

## PRM: permission requests

### OSW-PRM-101

> error: a permission request cannot be answered under autonomyLevel "autonomous": {request}

Why: An autonomous run has nobody to ask, and it does not grant itself what it was not given.

What to do: Run the change at "semi-autonomous", or give the agent what it asked for in its settings.

### OSW-PRM-102

> warning: denied, nobody at this terminal to ask: {request}

Why: The CLI's input is not a terminal, so nobody can answer, and the request is denied.

What to do: Run it in a terminal to be asked, or from the card.

## GIT: git, branches, worktrees, push, pull requests

### OSW-GIT-001

> warning: {name} has no worktree of its own: {why}.

Why: Commit Change commits only in a change's own worktree, on its own branch.

What to do: Make the change's worktree, or work the change there.

### OSW-GIT-002

> warning: {name} is on {branch}, the default branch; nothing of a change is committed there.

Why: A change reaches the default branch through its pull request, never by a commit on it (ADR 0043).

What to do: Work the change on a branch of its own, named after it.

### OSW-GIT-101

> error: Nothing of {name} was committed: {why}

Why: git refused the commit: often no author is configured, or a hook failed.

What to do: Put right what git says, then choose Commit Change again.

### OSW-GIT-102

> error: The push of {branch} was refused{after}: {why}

Why: The server, or the credentials git uses for it, refused the branch. A commit already made stays.

What to do: Put right what the server says - access, credentials, a branch rule - then choose Commit Change again.

### OSW-GIT-103

> error: git stage failed at commit: {why}

Why: The git stage commits what the stages left before it pushes, and git refused that commit.

What to do: Put right what git says in the change's worktree, then run the chain again from git.

### OSW-GIT-201

> info: Committed {name} as {commit} and pushed it to {pushedTo}.

Why: Commit Change committed what the change's worktree held, on its branch, and pushed the branch.

What to do: Nothing: the change is on the server, where every directory, host and person can see it.

### OSW-GIT-202

> info: {name} had nothing to commit; its branch is pushed to {pushedTo}.

Why: Everything in the change's worktree was committed already, and the push brought the server up to date.

What to do: Nothing.

### OSW-GIT-203

> warning: {name} is made in {directory}, but not on the server: {why}

Why: A new change is committed on its branch and pushed at once; that failed, so no other directory, host or person sees it yet.

What to do: Put right what was refused, then choose Commit Change on the change's card.

## CLI: the CLI's arguments and subcommands

### OSW-CLI-001

> error: '{former}' was renamed: use 'openspec-ui-cli {replacement}' (ADR 0045)

Why: Every subcommand became a verb and a noun (ADR 0045), and a former name is refused rather than kept as an alias.

What to do: Use the subcommand the message names, in the script or habit that typed the former one.

### OSW-CLI-002

> error: unknown command '{command}' (supported: {supported})

Why: What was typed is no subcommand, former or current.

What to do: Use one of the subcommands listed; `openspec-ui-cli --help` says what each does.

### OSW-CLI-003

> error: {option} requires a value

Why: An option that takes a value was the last word typed.

What to do: Give the option its value: `--cwd <directory>`, `--change <name>`.

### OSW-CLI-004

> error: --format must be 'json' or 'text'

Why: `--format` takes one of two values.

What to do: Use `--format json` for a program to read, `--format text` for a person.

### OSW-CLI-005

> error: {subcommand} requires a change name

Why: The subcommand acts on one change, and none was named.

What to do: Name the change after the subcommand, as its folder under openspec/changes is named.

### OSW-CLI-006

> error: set lock requires a resource name

Why: A lock is taken on something named, and nothing was.

What to do: Name the resource: `openspec-ui-cli set lock <resource>`.

### OSW-CLI-007

> error: --wait takes a number of seconds

Why: `--wait` was given something that is not a number.

What to do: Give it a number of seconds: `--wait 30`.

### OSW-CLI-008

> error: join team requires --handle and --name

Why: A person joins the team under a handle and a name, and one was missing.

What to do: Give both: `openspec-ui-cli join team --handle <handle> --name "<name>"`.

### OSW-CLI-009

> error: reopen change requires --stage proposed|planned|in-progress|in-review and --reason &lt;text>

Why: A change is sent back to a stage that is named, for a reason that is written down.

What to do: Give both the stage and the reason.

### OSW-CLI-010

> error: stop run needs the instance id of the run to ask, as 'openspec-ui-cli show status' prints it

Why: A run is asked to stop by its instance id, and none was given.

What to do: Run `openspec-ui-cli show status`, and pass the id it prints for the run.

### OSW-CLI-011

> error: stop run needs a reason: --reason &lt;text>

Why: A stop is recorded with why it was asked for.

What to do: Add `--reason "<why>"`.

### OSW-CLI-012

> error: --after takes a task number, such as 4.6; it was given {given}

Why: `--after` names the task after which the run stops, by its number in tasks.md.

What to do: Give the task's number as tasks.md numbers it.

### OSW-CLI-013

> error: {subcommand} needs the task's number, as tasks.md numbers it (for example 6.4)

Why: A task is named by its number, and none was given.

What to do: Add the task's number after the change's name.

### OSW-CLI-014

> error: name what to do: complete task, reopen task or commit tasks

Why: The tasks handler was reached with no action.

What to do: Use one of the three subcommands.

### OSW-CLI-015

> error: unknown lease action '{action}' (supported: release)

Why: The lease handler was reached with an action it does not take.

What to do: Use `openspec-ui-cli show lease` or `openspec-ui-cli remove lease`.

### OSW-CLI-016

> error: answer question {change} {question} needs the answer, in quotes

Why: The answer was missing, or blank.

What to do: Put the answer after the question's id, in quotes.
