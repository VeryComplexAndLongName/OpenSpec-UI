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

## HRN: harness settings

### OSW-HRN-001

> error: reviewGate.mode "agent-sufficient" is only valid in a per-change harness.json, never in the global openspec/agent-harness.json

Why: The global file set the review gate so an agent reviews its own work, which only one change may decide.

What to do: Move the setting into the change's own harness.json, or use "human-required" in the global file.

### OSW-HRN-002

> error: autonomyLevel "autonomous" is only valid in a per-change harness.json, never in the global openspec/agent-harness.json

Why: The global file set a level that runs without a person, which is chosen for one change at a time.

What to do: Set the level in the change's own harness.json, or lower it in the global file.

### OSW-HRN-003

> error: checkpoints.requireConfirmationBetweenSteps: false is only valid in a per-change harness.json, never in the global openspec/agent-harness.json

Why: The global file turned off the between-stage confirmation that only a change may waive.

What to do: Move the setting into the change's own harness.json, or remove it from the global file.

### OSW-HRN-004

> error: gitStageAllowlist is only valid in a per-change harness.json, never in the global openspec/agent-harness.json

Why: A git-stage allowlist is a change's own decision about what it may push, so a global one is refused.

What to do: Move the allowlist into the change's own harness.json.

### OSW-HRN-005

> error: taskAgents is only valid in a per-change harness.json, never in the global openspec/agent-harness.json — a task number names a task of one change

Why: A task number belongs to one change's tasks.md, so a workspace-wide mapping cannot mean anything.

What to do: Move the taskAgents section into the change's own harness.json.

### OSW-HRN-006

> error: steps is only valid in a per-change harness.json, never in the global openspec/agent-harness.json — a declared step belongs to the chain of one change

Why: A declared step is placed in one change's chain, so a global one would apply to every change forever.

What to do: Move the steps list into the change's own harness.json.

### OSW-HRN-007

> error: supervisor.mode "act" needs autonomyLevel "autonomous" in the same file: under a level that asks a person, the person decides. Open the change's Harness Settings and save to turn Act off, or set autonomyLevel "autonomous"

Why: Act lets the supervisor start another agent, which a level that asks a person does not allow.

What to do: Open the change's Harness Settings and save to turn Act off, or set autonomyLevel to "autonomous".

### OSW-HRN-008

> error: supervisor.mode "act" repeats or moves a failed stage as another attempt of it, and maxStageAttempts is {attempts}: set it above 1 in this change's harness.json, or choose "advise"

Why: Act spends another attempt when it repeats or moves a stage, and a ceiling of one leaves it nothing to spend.

What to do: Raise maxStageAttempts above 1 in the change's harness.json, or choose "advise".

### OSW-HRN-009

> warning: Migrated legacy harness dispatch settings in {file}: {reports}

Why: An older harness file used the retired dispatch keys, and the migration rewrote them so the settings are read.

What to do: Nothing, the migration is automatic; save the file to keep the new form.

### OSW-HRN-010

> warning: stepAgents.{stage}.dispatch "vscode-chat" was migrated to stepAgents.{stage}.agent "{agent}"

Why: A stepAgents entry named the editor's chat through the retired dispatch key, which is now written as an agent id.

What to do: Nothing; the entry now names the VS Code chat agent directly.

### OSW-HRN-011

> warning: stepAgents.{stage} was dropped — "{stage}" is a mechanical stage and never invokes an agent

Why: The configuration set an agent for a stage that runs no agent, so the entry never did anything.

What to do: Nothing; the setting was removed from the resolved configuration.

### OSW-HRN-012

> error: budget.maxCost must be an object of unit to ceiling

Why: The per-unit budget was written as something other than a map from unit to ceiling.

What to do: Write it as an object, such as { "credits": 500 }.

### OSW-HRN-013

> error: budget.maxCost has a ceiling under an empty unit

Why: A ceiling was filed under a blank unit name, which no report can be compared against.

What to do: Name the unit, or remove the entry.

### OSW-HRN-014

> error: budget.maxCost.{unit} must be a positive number

Why: A per-unit ceiling was not a positive finite number.

What to do: Give the unit a positive number as its ceiling.

### OSW-HRN-015

> error: {label} has unknown key "{key}" (accepted keys: {keys})

Why: An agent entry carried a key this product does not read, so it would silently do nothing.

What to do: Remove the key or use one of the accepted keys named.

### OSW-HRN-016

> error: {label} must be a non-empty string

Why: An agent entry was written as something other than the agent id string it must be.

What to do: Write the agent id as a non-empty string.

### OSW-HRN-017

> error: {label} references unknown agent id "{agent}"

Why: The entry names an agent id that no registered agent or the editor's chat has.

What to do: Use a registered agent id, or install the agent that id belongs to.

### OSW-HRN-018

> error: {label} selects agent "{agent}", which is only valid under autonomyLevel "assisted" — a chain cannot use it

Why: The editor's chat can only run under assisted autonomy, where a person starts each stage.

What to do: Use a CLI agent under this level, or set autonomyLevel to "assisted".

### OSW-HRN-019

> error: {label}.model cannot reach anything when agent "{agent}" dispatches to VS Code chat

Why: A model id has no effect when the entry dispatches to the editor's chat.

What to do: Remove the model, or choose an agent that takes a model id.

### OSW-HRN-020

> error: {label}.model "{model}" is not a valid model id

Why: A model id reached a command line as a flag value and did not have the shape one may have.

What to do: Give a model id of letters, digits, ".", "_", ":" and "-", not beginning with "-".

### OSW-HRN-021

> error: {label} sets a model, but agent "{agent}" does not accept one

Why: The named agent has no command-line way to take a model id.

What to do: Remove the model, or choose an agent that accepts one.

### OSW-HRN-022

> error: {label}.customAgent cannot reach anything when agent "{agent}" dispatches to VS Code chat

Why: A custom agent flag has no effect when the entry dispatches to the editor's chat.

What to do: Remove the customAgent, or choose an agent that accepts one.

### OSW-HRN-023

> error: {label}.customAgent must be a non-empty string

Why: The custom agent was written as something other than the flag value it must be.

What to do: Write the custom agent as a non-empty string.

### OSW-HRN-024

> error: {label}.customAgent "{customagent}" must not begin with "-" and may contain only letters, digits, ".", "_", ":" and "-"

Why: A value that reaches argv as a flag value must not look like another flag.

What to do: Rename the custom agent so it begins with a letter or digit and uses only the allowed characters.

### OSW-HRN-025

> error: {label} sets a custom agent, but agent "{agent}" does not accept one

Why: The named agent's command line has no flag for a custom agent.

What to do: Remove the customAgent, or choose an agent that accepts one.

### OSW-HRN-026

> error: {label}.effort cannot reach anything when agent "{agent}" dispatches to VS Code chat

Why: A reasoning effort has no effect when the entry dispatches to the editor's chat.

What to do: Remove the effort, or choose an agent with an effort control.

### OSW-HRN-027

> error: {label}.effort must be one of: {values}

Why: The effort was not one of the values this product recognises.

What to do: Use one of the listed effort values.

### OSW-HRN-028

> error: {label} sets effort, but agent "{agent}" has no command-line reasoning-effort control

Why: The named agent has no way to be told how much reasoning to spend.

What to do: Remove the effort, or choose an agent that takes one.

### OSW-HRN-029

> error: {label}.effort "{effort}" is not accepted by agent "{agent}" (accepted: {values})

Why: The named agent takes an effort, but not this one.

What to do: Use one of the effort values the agent accepts.

### OSW-HRN-030

> error: {label}.budget cannot reach anything when agent "{agent}" dispatches to VS Code chat

Why: A budget has no effect when the entry dispatches to the editor's chat.

What to do: Remove the budget, or choose an agent that takes a cap.

### OSW-HRN-031

> error: {label}.budget must be an object

Why: The entry's budget was written as something other than an object of caps.

What to do: Write the budget as an object with maxCostUsd or maxAiCredits.

### OSW-HRN-032

> error: {label}.budget has unknown key "{key}" (accepted keys: {keys})

Why: The budget carried a cap key this product does not read.

What to do: Remove the key or use one of the accepted keys named.

### OSW-HRN-033

> error: {label}.budget must set maxCostUsd or maxAiCredits

Why: The budget was present but named no cap at all.

What to do: Set maxCostUsd or maxAiCredits, or remove the budget.

### OSW-HRN-034

> error: {label}.budget.maxCostUsd must be a positive number

Why: The per-stage dollar cap was not a positive finite number.

What to do: Give it a positive number.

### OSW-HRN-035

> error: {label} sets budget.maxCostUsd, but agent "{agent}" does not accept a cost cap in USD

Why: The named agent's command line has no dollar cost cap.

What to do: Remove maxCostUsd, or choose an agent billed in a unit it caps.

### OSW-HRN-036

> error: {label}.budget.maxAiCredits must be a positive integer

Why: The AI-credit cap was not a positive whole number.

What to do: Give it a positive whole number.

### OSW-HRN-037

> error: {label} sets budget.maxAiCredits, but agent "{agent}" does not accept a credit cap

Why: The named agent's command line has no AI-credit cap.

What to do: Remove maxAiCredits, or choose an agent that takes one.

### OSW-HRN-038

> error: {label}.budget.maxAiCredits must be at least {minimum} (copilot-cli's own minimum)

Why: copilot-cli refuses a credit cap below its own minimum.

What to do: Raise the cap to at least the named minimum.

### OSW-HRN-039

> error: stepAgents must be an object

Why: The stepAgents section was written as something other than an object of stage entries.

What to do: Write it as an object keyed by stage.

### OSW-HRN-040

> error: stepAgents.{stage} is not accepted — "{stage}" is a mechanical stage and never invokes an agent

Why: The stage runs no agent, so an entry for it can never do anything.

What to do: Remove the entry from stepAgents.

### OSW-HRN-041

> error: unknown stepAgents key "{stage}" (expected one of: {stages})

Why: A stepAgents key is not a stage that runs an agent.

What to do: Use one of the listed stage names.

### OSW-HRN-042

> error: taskAgents must be an object

Why: The taskAgents section was written as something other than an object of task entries.

What to do: Write it as an object keyed by task number.

### OSW-HRN-043

> error: taskAgents key "{task}" is not a task number (expected the leading number of a tasks.md line, such as "5.4")

Why: An entry filed under something other than a task number can never match a task line.

What to do: Key the entry by the leading number of a tasks.md line.

### OSW-HRN-044

> error: {label} selects agent "{agent}", which cannot run one task — a delegated item's run spawns a CLI agent

Why: A numbered task is delegated to a spawned CLI agent, which the editor's chat cannot be.

What to do: Use a CLI agent for the task.

### OSW-HRN-045

> error: autonomyLevel must be one of: {levels}

Why: The autonomy level was not one this product recognises.

What to do: Use one of the listed autonomy levels.

### OSW-HRN-046

> error: reviewGate must be an object

Why: The review gate was written as something other than an object with a mode.

What to do: Write it as an object with a mode of "human-required" or "agent-sufficient".

### OSW-HRN-047

> error: reviewGate.mode must be one of: {modes}

Why: The review gate mode was not one this product recognises.

What to do: Use "human-required" or "agent-sufficient".

### OSW-HRN-048

> error: hints must be an object

Why: The hints section was written as something other than an object with an enabled flag.

What to do: Write it as an object with an enabled boolean.

### OSW-HRN-049

> error: hints.enabled must be a boolean

Why: The hints switch was not true or false.

What to do: Set hints.enabled to true or false.

### OSW-HRN-050

> error: supervisor must be an object

Why: The supervisor section was written as something other than an object of its keys.

What to do: Write it as an object of the accepted supervisor keys.

### OSW-HRN-051

> error: supervisor has no key "{key}" (accepted keys: {keys})

Why: The supervisor section carried a key this product does not read.

What to do: Remove the key or use one of the accepted keys named.

### OSW-HRN-052

> error: supervisor.mode must be one of: {modes}

Why: The supervisor mode was not one this version knows, and an unknown mode is refused rather than read as advise.

What to do: Use "off", "advise" or "act".

### OSW-HRN-053

> error: supervisor.mode "act" is set in a change's own harness.json, never for the whole workspace: it may start another agent unattended

Why: Acting may start another agent, which is a change's own decision, not a workspace default.

What to do: Move supervisor.mode "act" into the change's own harness.json.

### OSW-HRN-054

> error: supervisor.{key} must be a positive whole number of seconds

Why: A supervisor threshold was not a positive whole number of seconds.

What to do: Give it a positive whole number.

### OSW-HRN-055

> error: supervisor.{key} must be a boolean

Why: A supervisor switch was not true or false.

What to do: Set it to true or false.

### OSW-HRN-056

> error: supervisor.{key} is set in a change's own harness.json, never for the whole workspace

Why: Allowing a cost or provider change is a decision only one change may make.

What to do: Move the key into the change's own harness.json.

### OSW-HRN-057

> error: supervisor.fallback must be an object of stages

Why: The fallback section was written as something other than an object keyed by stage.

What to do: Write it as an object mapping stage names to agent lists.

### OSW-HRN-058

> error: supervisor.fallback.{stage} names no stage that runs an agent

Why: A fallback was declared for a stage that invokes no agent.

What to do: Remove the entry, or name a stage that runs an agent.

### OSW-HRN-059

> error: supervisor.fallback.{stage} must be a non-empty list of agent ids

Why: A fallback for a stage was written as something other than a non-empty list of agent ids.

What to do: Give the stage a non-empty list of registered agent ids.

### OSW-HRN-060

> error: supervisor.fallback.{stage} may not name {agent}: a chain cannot hand a stage it attempts again to the editor's chat

Why: A chain retries a stage by spawning a CLI agent, which the editor's chat cannot be.

What to do: Use a CLI agent in the fallback list.

### OSW-HRN-061

> error: supervisor.fallback.{stage} names "{agent}", which is not a registered agent

Why: A fallback names an agent id no registered agent has.

What to do: Use a registered agent id, or install that agent.

### OSW-HRN-062

> error: supervisor.fallback.{stage} names "{agent}" twice

Why: A fallback list that repeats an agent would try it twice for one failure.

What to do: Remove the duplicate entry.

### OSW-HRN-063

> error: checkpoints must be an object

Why: The checkpoints section was written as something other than an object.

What to do: Write it as an object with requireConfirmationBetweenSteps.

### OSW-HRN-064

> error: checkpoints.requireConfirmationBetweenSteps must be a boolean

Why: The between-stage confirmation switch was not true or false.

What to do: Set requireConfirmationBetweenSteps to true or false.

### OSW-HRN-065

> error: budget must be an object

Why: The budget section was written as something other than an object of ceilings.

What to do: Write it as an object of the accepted budget keys.

### OSW-HRN-066

> error: budget.maxCostUsd must be a positive number

Why: The whole-chain dollar ceiling was not a positive finite number.

What to do: Give it a positive number.

### OSW-HRN-067

> error: budget.maxTokens must be a positive integer

Why: The whole-chain token ceiling was not a positive whole number.

What to do: Give it a positive whole number.

### OSW-HRN-068

> error: budget.maxStageCostUsd must be a positive number

Why: The per-stage dollar ceiling was not a positive finite number.

What to do: Give it a positive number.

### OSW-HRN-069

> error: budget.maxStageTokens must be a positive integer

Why: The per-stage token ceiling was not a positive whole number.

What to do: Give it a positive whole number.

### OSW-HRN-070

> error: budget.maxContextShare must be a share above 0 and at most 1, such as 0.8 for eighty percent

Why: The context ceiling is a share, and a value like 80 would never fire.

What to do: Write the share as a fraction above 0 and at most 1.

### OSW-HRN-071

> error: budget.maxStageCostUsd ({stage}) must not exceed budget.maxCostUsd ({chain}), because the chain ceiling would stop the run first and the stage ceiling could never fire

Why: A per-stage ceiling above the chain ceiling can never be reached.

What to do: Lower the stage ceiling, or raise the chain ceiling above it.

### OSW-HRN-072

> error: budget.maxStageTokens ({stage}) must not exceed budget.maxTokens ({chain}), because the chain ceiling would stop the run first and the stage ceiling could never fire

Why: A per-stage token ceiling above the chain ceiling can never be reached.

What to do: Lower the stage ceiling, or raise the chain ceiling above it.

### OSW-HRN-073

> error: timeout must be an object

Why: The timeout section was written as something other than an object of limits.

What to do: Write it as an object with maxRunSeconds or maxStageSeconds.

### OSW-HRN-074

> error: timeout.{key} must be a positive integer number of seconds

Why: A time ceiling was not a positive whole number of seconds.

What to do: Give it a positive whole number of seconds.

### OSW-HRN-075

> error: timeout.maxStageSeconds ({stage}) must not exceed timeout.maxRunSeconds ({run}), because the run ceiling would stop the chain first and the stage ceiling could never fire

Why: A per-stage time limit above the run limit can never be reached.

What to do: Lower the stage limit, or raise the run limit above it.

### OSW-HRN-076

> error: skipStages must be a list of stage names

Why: The skipStages value was written as something other than a list of stage names.

What to do: Write it as a list, such as ["review"].

### OSW-HRN-077

> error: skipStages may leave out only "review"; "{stage}" is not a stage it can skip

Why: Only the review stage may be left out of a chain.

What to do: Remove the stage name, or use "review".

### OSW-HRN-078

> error: skipStages names "{stage}" twice

Why: A stage listed twice would be skipped twice for no reason.

What to do: Remove the duplicate.

### OSW-HRN-079

> error: maxStageAttempts must be a positive integer

Why: The stage attempt ceiling was not a positive whole number.

What to do: Give it a positive whole number.

### OSW-HRN-080

> error: gitStageAllowlist must be an object

Why: The allowlist was written as something other than an object of patterns.

What to do: Write it as an object with remotes and branches.

### OSW-HRN-081

> error: gitStageAllowlist has unknown key "{key}" (accepted keys: {keys})

Why: The allowlist carried a key this product does not read.

What to do: Remove the key or use one of the accepted keys named.

### OSW-HRN-082

> error: gitStageAllowlist.remotes must be a non-empty string array

Why: The remotes pattern list was empty or held something that is not a string.

What to do: Give it a non-empty list of remote patterns.

### OSW-HRN-083

> error: gitStageAllowlist.branches must be a non-empty string array

Why: The branches pattern list was empty or held something that is not a string.

What to do: Give it a non-empty list of branch patterns.

### OSW-HRN-084

> error: unrecognized top-level key "{key}" (accepted keys: {keys}).{hint}

Why: A harness file carried a top-level key the schema does not define, which would otherwise be silently ignored.

What to do: Remove the key, or use the accepted key it was meant to be.

### OSW-HRN-085

> error: root value must be an object

Why: The harness file's JSON was not an object at all.

What to do: Write the file as a JSON object of settings.

### OSW-HRN-086

> error: allowAgentMessages must be a boolean

Why: The switch that lets a run take another run's messages was not true or false.

What to do: Set allowAgentMessages to true or false.

### OSW-HRN-087

> error: branches must be an object

Why: The branches section was written as something other than an object.

What to do: Write it as an object with rebaseWhenBehind or followMain.

### OSW-HRN-088

> error: branches has no key "{key}"; the ones it takes are rebaseWhenBehind and followMain

Why: The branches section carried a key this product does not read.

What to do: Remove the key, or use rebaseWhenBehind or followMain.

### OSW-HRN-089

> error: branches.{key} must be a boolean

Why: A branch switch was not true or false.

What to do: Set it to true or false.

### OSW-HRN-090

> error: archive must be an object

Why: The archive section was written as something other than an object.

What to do: Write it as an object with whenLanded.

### OSW-HRN-091

> error: archive has no key "{key}"; the one it takes is whenLanded

Why: The archive section carried a key this product does not read.

What to do: Remove the key, or use whenLanded.

### OSW-HRN-092

> error: archive.whenLanded must be a boolean

Why: The landed-archive switch was not true or false.

What to do: Set archive.whenLanded to true or false.

### OSW-HRN-093

> error: steps must be an array

Why: The declared steps were written as something other than a list.

What to do: Write steps as a JSON array of step declarations.

### OSW-HRN-094

> error: {label} must be an object

Why: One declared step was written as something other than an object.

What to do: Write that step as an object with step and exactly one of before or after.

### OSW-HRN-095

> error: unrecognized key "{key}" in {label} (accepted keys: {keys})

Why: A declared step carried a key this product does not read.

What to do: Remove the key or use one of the accepted keys named.

### OSW-HRN-096

> error: {label}.step is not a declared step (expected one of: {steps})

Why: The step name is not in the closed registry of steps this product runs.

What to do: Use one of the listed step names.

### OSW-HRN-097

> error: {label} must state exactly one of "before" or "after"{suffix}

Why: A declared step must be placed against exactly one fixed stage.

What to do: State exactly one position: before or after.

### OSW-HRN-098

> error: {label}.{position} must name a stage (expected one of: {stages}) — a step is placed against the fixed sequence, never against another declared step

Why: A declared step is placed against a fixed stage, not against another declared step.

What to do: Use one of the listed fixed stage names.

### OSW-HRN-099

> error: {label}.param must be a string

Why: The step's argument was written as something other than text.

What to do: Write the param as a string, or remove it.

### OSW-HRN-100

> error: {label}.param is required for step "{step}"

Why: This step cannot run without its own argument.

What to do: Add the param the step needs.

### OSW-HRN-101

> error: {label}.maxWaitSeconds must be a positive number of seconds

Why: The waiting step's time limit was not a positive finite number of seconds.

What to do: Give it a positive number of seconds.

### OSW-HRN-102

> error: steps[{index}] ({step}) is placed {position} "{stage}", which skipStages leaves out; place it against another stage

Why: A declared step placed against a skipped stage would never run and would say nothing.

What to do: Place the step against a stage that is not skipped.

### OSW-HRN-103

> warning: "{agent}" answers in text and edits no file, so "{stage}" on it writes nothing: the proposal, the implementation and the ticked tasks are files. It can review.

Why: The stage's work must be left in files, and this agent only answers in text.

What to do: Choose an agent that edits files for this stage, or accept that the stage writes nothing.

### OSW-HRN-104

> warning: "{agent}" never says how full its context is, so budget.maxContextShare cannot act on "{stage}". That ceiling reads a figure only an ACP agent sends.

Why: The agent sends no context gauge, so the context ceiling has no figure to compare.

What to do: Use an agent that sends a context gauge, or drop budget.maxContextShare.

### OSW-HRN-105

> warning: "{agent}" has never been observed reporting its usage here, so whether a spending ceiling can act on "{stage}" is not known. A time ceiling needs no report and applies regardless.

Why: The agent's usage reporting has never been watched, so no ceiling's effect can be asserted.

What to do: Configure a time ceiling, which needs no report, and watch a run to learn what the agent reports.

### OSW-HRN-106

> warning: "{agent}" reports no usage at all, so no spending ceiling can act on "{stage}" however large the spend.

Why: The agent reports nothing for a spending ceiling to compare against.

What to do: Use a time or context ceiling, or choose an agent that reports usage.

### OSW-HRN-107

> warning: "{stage}" can run without any bound: "{agent}" reports nothing for a spending ceiling to compare, and no timeout is configured. A time ceiling is the only one that applies here.

Why: Nothing bounds the stage: the agent reports no usage and no time limit is set.

What to do: Configure timeout.maxStageSeconds or maxRunSeconds for the stage.

### OSW-HRN-108

> warning: "{agent}" reports tokens and no cost, so a cost ceiling cannot act on "{stage}". A token ceiling is the one that can.

Why: The agent counts tokens but not money, so a dollar ceiling has nothing to compare.

What to do: Use budget.maxTokens or budget.maxStageTokens instead of a cost ceiling.

### OSW-HRN-109

> warning: budget.maxCost sets a ceiling in "{unit}", and "{agent}" is billed in {billing}, so that ceiling cannot act on "{stage}". The ceiling in its own unit is the one that can.

Why: The ceiling's unit does not match the unit the agent is billed in, so nothing is ever converted.

What to do: Set the ceiling in the unit the agent is billed in.

### OSW-HRN-110

> warning: A token ceiling counts input plus output only, and "{agent}" moves most of its tokens through cache — a measured run recorded 1,693,507 cache tokens against 8,322 counted ones, so a token ceiling will rarely act on "{stage}". A cost ceiling acts on it directly.

Why: A cache-heavy agent's counted tokens are a small fraction of what it moves, so a token ceiling rarely fires.

What to do: Use a cost ceiling, or expect the token ceiling to act late.

### OSW-HRN-111

> error: "{change}" is not a valid change name

Why: The chain was started with a name no change may have.

What to do: Name the change as its folder under openspec/changes is named.

### OSW-HRN-112

> error: no active change named "{change}" in {directory} — an archived change is finished and is not re-run

Why: No active change of that name exists, and an archived change is not run again.

What to do: Check the name, or create the change first.

### OSW-HRN-113

> error: this change's harness configuration could not be read: {reason}

Why: The change's harness.json is malformed or invalid, so the chain cannot know how to run.

What to do: Fix the configuration the reason names, then start the chain again.

### OSW-HRN-114

> error: this change's autonomyLevel is "{level}", which starts one stage at a time through a picker rather than running a chain. There is nothing to open here; start the stage from the standalone shell or the VS Code command, or set a chain-running autonomy level for this change.

Why: The change's autonomy level runs stages one at a time, so there is no chain to start.

What to do: Start the stage individually, or set a chain-running autonomy level for the change.

### OSW-HRN-115

> error: this change's configuration pauses between stages for a confirmation, and there is no terminal here to put that choice to. Run it where somebody can answer, or set checkpoints.requireConfirmationBetweenSteps to false in openspec/changes/{change}/harness.json to say that this change may run unattended.

Why: The change asks for a confirmation between stages, and nothing here can put that question to a person.

What to do: Run it where somebody can answer, or turn the confirmation off in the change's harness.json.

### OSW-HRN-116

> error: this change declares that it is blocked by {blockers}, which {verb} still active. Land it and archive it, or remove the line from openspec/changes/{change}/.openspec.yaml — there is no option that starts it anyway, because the declaration is a sentence its author wrote in a file under version control.

Why: The change declares a blocker that is still active, and the declaration itself refuses the run.

What to do: Land and archive the blocker, or remove the blocking line from the change's .openspec.yaml.

### OSW-HRN-117

> error: steps[{index}] waits for "{change}", which is this change itself — a change cannot wait for itself, and this reads as the name of another one

Why: A declared await-change step names the change it belongs to, which would wait forever.

What to do: Point the step at the change it actually waits for.

### OSW-HRN-118

> error: the "{stage}" stage names agent "{agent}", which this build has no runner for

Why: This build ships no runner for the agent the stage names.

What to do: Install that agent or choose one this build can run.

### OSW-HRN-119

> error: the "{stage}" stage has no agent configured and this build has no default runner

Why: The stage names no agent and this build has no default runner to fall back to.

What to do: Set an agent for the stage in the change's harness.json.

### OSW-HRN-120

> warning: {agent} is not a registered agent

Why: A fallback candidate is not one of the agents this build knows.

What to do: Add the agent to the fallback list only if this build ships it.

### OSW-HRN-121

> warning: {agent} is another provider ({provider}), and allowProviderChange is false

Why: Moving the stage to that agent would send the change's files to another company, which this change has not allowed.

What to do: Set supervisor.allowProviderChange to true, or choose a fallback on the same provider.

### OSW-HRN-122

> warning: {agent} may cost money, and allowCostIncrease is false

Why: Moving the stage to that agent may cost more, which this change has not allowed.

What to do: Set supervisor.allowCostIncrease to true, or choose a free fallback.

### OSW-HRN-123

> info: the cause is not known, so the stage is neither repeated nor moved

Why: The failure's cause could not be diagnosed, so the supervisor cannot tell whether repeating or moving would help.

What to do: Read the run's reply and diagnose the failure before acting.

### OSW-HRN-124

> info: {cause}, and {stage} names no fallback agent

Why: The stage has no fallback configured, so the supervisor has nowhere to move it.

What to do: Add a fallback list for the stage if a move might help.

### OSW-HRN-125

> info: {cause}, and the policy refuses every fallback left: {refusals}

Why: Every fallback the stage names is refused by the change's policy, so no move is possible.

What to do: Allow the cost or provider change, or add a fallback the policy permits.

### OSW-HRN-126

> info: {cause}, and every fallback for {stage} has been tried

Why: The stage has already run on each of its fallbacks, so none is left to try.

What to do: Fix the underlying cause, or add a further fallback.

### OSW-HRN-127

> info: {cause} (passed over: {refusals})

Why: The stage moved to a fallback and this names the ones skipped on the way, so a person can see why.

What to do: Nothing, unless the passed-over agents were the ones you wanted.

## AGT: agents and adapters: missing, signed out, failed

### OSW-AGT-001

> warning: not valid JSON

Why: A status record or roster file on disk could not be read as JSON.

What to do: Report it; the file is corrupt and the record it was meant to carry is not trusted.

### OSW-AGT-002

> warning: its signed payload is not valid JSON

Why: A signed status record's payload did not parse after its signature verified.

What to do: Report it; the record cannot be trusted and is not read.

### OSW-AGT-003

> warning: missing or invalid required fields

Why: A status record or roster entry lacks a field the reader needs to trust it.

What to do: Report it; the file is written wrongly and is not trusted.

### OSW-AGT-004

> warning: record identity "{instanceId}" does not match file name "{expectedId}"

Why: A status record names an instance other than the file it was found in.

What to do: Report it; the record is not taken as the run's own.

### OSW-AGT-005

> warning: activityAt or heartbeatAt is not a valid timestamp

Why: A status record's activity or heartbeat time could not be read as a date.

What to do: Report it; the record's age cannot be judged.

### OSW-AGT-006

> warning: not an entry

Why: A roster file did not hold a JSON object.

What to do: Report it; the file is not taken as an enrolment.

### OSW-AGT-007

> warning: its file name does not match its key id "{keyId}"

Why: A roster file is named for a key id other than the one it holds.

What to do: Report it; the entry is not trusted.

### OSW-AGT-008

> warning: its key does not match its key id

Why: A roster entry's public key does not match the key id it claims.

What to do: Report it; the entry is not trusted.

### OSW-AGT-009

> error: the key offered for {keyId} does not match that key id

Why: An enrolment was offered a public key that does not match the key id it names.

What to do: Read the machine's key again, and enrol only a key that matches its id.

### OSW-AGT-010

> error: {keyId} is already enrolled with a different key

Why: A key id is already enrolled here under another public key.

What to do: Remove the old enrolment, or enrol the machine under a new key.

### OSW-AGT-101

> warning: not verified

Why: A stop request or message was not signed by a key the roster knows.

What to do: Enrol the sender's key, or ask from a machine whose key is enrolled.

### OSW-AGT-102

> warning: stale

Why: A stop request or message arrived after the window in which a run acts on it.

What to do: Ask again from the run's card while the run is live.

### OSW-AGT-103

> warning: already read

Why: The same stop request or message was read and acted on before.

What to do: Nothing; a request is read once and not acted on twice.

### OSW-AGT-104

> warning: from a run, which this run does not take

Why: A message was written by another run, and this run does not take instructions from a run.

What to do: Turn on allowAgentMessages for this run, or send the message as a person.

### OSW-AGT-201

> error: the agent is not installed

Why: The agent's executable was not found, so the run could not start it.

What to do: Install the agent, or choose another agent for the stage.

### OSW-AGT-202

> error: the agent is not signed in

Why: The agent refused the work because no signed-in account was found.

What to do: Sign the agent in, then start the run again.

### OSW-AGT-203

> error: the machine blocked the agent

Why: Security software or file permissions stopped the agent from a file or a program.

What to do: Allow the agent there, then start the run again.

### OSW-AGT-204

> error: the network could not be reached

Why: The agent could not reach the service it works through.

What to do: Check the address, the connection and any system proxy, then start the run again.

### OSW-AGT-205

> warning: the service rate-limited the agent

Why: The service limited how often it may be asked.

What to do: Wait for the limit to pass, then start the run again.

### OSW-AGT-206

> error: the service failed

Why: The service failed on its own side while the run was working.

What to do: Start the run again; the service's own failure often passes.

### OSW-AGT-207

> info: the cause is not known

Why: The failure's reason and output matched no cause this product knows.

What to do: Read the run's output, and report it if nothing there explains the failure.

### OSW-AGT-208

> warning: repeating will not help

Why: The cause is one a repeat of the run meets again unchanged.

What to do: Do what the remedy says instead of starting the run again.

### OSW-AGT-209

> info: repeating is likely to help

Why: The cause is one that passes by itself.

What to do: Start the run again after a moment.

### OSW-AGT-210

> info: whether repeating helps is not known

Why: No cause was recognised, so whether a repeat helps is unknown.

What to do: Read the run's output before deciding to start it again.

### OSW-AGT-211

> info: Install `{executable}` and make sure it is on the PATH, or choose another agent for this stage.

Why: The agent's executable is not installed, and this names it.

What to do: Install it and put it on the PATH, or choose another agent for the stage.

### OSW-AGT-212

> info: Install the agent and make sure it is on the PATH, or choose another agent for this stage.

Why: The agent is not installed and its executable is not known by name.

What to do: Install the agent and put it on the PATH, or choose another agent for the stage.

### OSW-AGT-213

> info: Run `{executable}` in a terminal and sign in, then start the run again.

Why: The agent is not signed in, and this names the executable that signs it in.

What to do: Run it in a terminal, sign in, then start the run again.

### OSW-AGT-214

> info: Sign the agent in, then start the run again.

Why: The agent is not signed in and its executable is not known by name.

What to do: Sign the agent in, then start the run again.

### OSW-AGT-215

> info: Something on this machine refused the agent a file or a program: security software, or the file's permissions. Allow it there, then start the run again.

Why: The machine, not the service, blocked the agent from a file or a program.

What to do: Allow the agent in the security software or the file's permissions, then start the run again.

### OSW-AGT-216

> info: The service limited how often it may be asked. Wait, then start the run again.

Why: The service rate-limited the run, and waiting is what clears it.

What to do: Wait for the limit to pass, then start the run again.

### OSW-AGT-217

> info: The service failed on its side. Starting the run again is likely to work.

Why: The service, not the run, failed, and such a failure often passes.

What to do: Start the run again.

### OSW-AGT-218

> error: agent refused the prompt

Why: The ACP agent ended its turn with a stop reason of refusal.

What to do: Read what the agent said, then start the run again or change the prompt.

### OSW-AGT-219

> error: cancellation could not be carried out: {killFailure}. The agent process may still be running.

Why: The cancellation could not kill the agent's process tree, for the reason given.

What to do: Check for the agent's process and terminate it by hand if it is still running.

### OSW-AGT-220

> error: the agent process did not exit within {seconds}s of being terminated, and may still be running.

Why: The ACP agent's process outlived the confirmation window after being terminated.

What to do: Check for the agent's process and terminate it by hand if it is still running.

### OSW-AGT-221

> error: no agent available to run the "{stage}" stage

Why: This host resolved no runner for the stage's agent, so the stage can run no work and the chain fails.

What to do: Configure or install an agent for that stage (or sign in the one it names), then run the change again.

## TSK: tasks: ticks, Human-only, delegation

### OSW-TSK-001

> error: change "{change}" has no tasks.md

Why: A delegated item was asked for a change whose tasks.md does not exist.

What to do: Check the change name, and that its tasks.md exists.

### OSW-TSK-002

> error: no task at line {line} of {change}/tasks.md

Why: The inbox asked to run the item at a line the change's task list does not have.

What to do: Refresh the inbox and choose the item again.

### OSW-TSK-003

> error: task at line {line} of {change}/tasks.md is already ticked

Why: A delegated run was asked for an item that is already closed.

What to do: Refresh the inbox and run an item that is still open.

### OSW-TSK-004

> error: the item at line {line} of {change}/tasks.md is marked for a person, and no agent is offered for it

Why: An item marked Human-only is for a person, and delegation is refused rather than quietly offered to an agent.

What to do: Do the item yourself, or remove the Human-only marking if an agent may do it.

### OSW-TSK-005

> error: the item at line {line} of {change}/tasks.md names no agent

Why: The item is not delegated to anything, so there is no agent to run.

What to do: Name an agent in the item's "Delegated to <id>" marker or in the change's taskAgents.

### OSW-TSK-006

> error: "{agent}" is not an agent this build recognises

Why: The item names an agent id that is not in this build's registry.

What to do: Correct the id, or use an agent this build carries.

### OSW-TSK-007

> error: change "{change}" was not found in this workspace

Why: The change is not among the workspace's active changes, so its directory cannot be used.

What to do: Refresh the Pipeline and check that the change is active.

### OSW-TSK-008

> error: no runner is configured for agent "{agent}"

Why: The agent id is known, but the host has no runner registered for it.

What to do: Configure the agent in the host, or choose another agent.

### OSW-TSK-009

> error: the line at {line} of {change}/tasks.md is not a checklist item

Why: The line the inbox reported no longer holds a checklist item.

What to do: Refresh the inbox and choose the item again.

### OSW-TSK-010

> error: Unknown mechanical check "{name}" (expected one of: {checks})

Why: A task's check(...) declaration names a mechanical check outside the registry.

What to do: Use one of the checks listed, or correct the name in tasks.md.

### OSW-TSK-011

> error: Invalid parameter for check "{name}" ("{param}"): {reason}

Why: A task's mechanical check declaration carries a parameter the check cannot take.

What to do: Correct the parameter in tasks.md as the reason says.

### OSW-TSK-012

> error: path-unchanged requires a repository-relative path parameter

Why: A path-unchanged check was declared with no parameter, so it could never run.

What to do: Give the check a repository-relative path parameter.

### OSW-TSK-013

> error: must be a repository-relative path, not absolute and not containing ".."

Why: A check parameter is absolute or traverses upward, so it cannot name a file inside the repository.

What to do: Use a path relative to the repository root and without "..".

### OSW-TSK-014

> error: Task list for {change} has changed since it was last loaded — refresh and try again.

Why: tasks.md was rewritten between reading and writing, so a stale line would have been changed.

What to do: Refresh the task list and make the change again.

### OSW-TSK-015

> info: a person

Why: An open item waits on a person rather than an agent.

What to do: Nothing: do the item when you reach it.

### OSW-TSK-016

> warning: "{agent}", which is not a registered agent

Why: An item names an agent id the workspace's registry does not carry, so it only looks assigned.

What to do: Correct the id in the task text or in the change's taskAgents.

### OSW-TSK-017

> warning: {waiting} (this change's harness.json names it; the task text names {textagent})

Why: The change's configuration and the task's own text name different agents for one item.

What to do: Settle which agent owns the item, in harness.json or in the task text.

### OSW-TSK-018

> warning: {change} names {agent} for task {task}, but {where}

Why: A change's taskAgents key names an agent for a task that is gone or waits on a person.

What to do: Remove or correct the taskAgents key named.

### OSW-TSK-019

> info: No active change to look at.{enrolments}

Why: The workspace holds no active change, so the inbox has nothing to read.

What to do: Open or create a change, or check the workspace root.

### OSW-TSK-020

> info: Nothing is waiting — {changes} read.{stale}

Why: Active changes were read and none holds an item waiting on a person or an agent.

What to do: Nothing, unless a change that should be listed is missing from those read.

### OSW-TSK-021

> info: {items} items waiting, across {changes} of {total} active changes: {waiting}.{stale}

Why: Open items wait across the workspace, some on a person and some on an agent.

What to do: Work the items, or hand the agents' items to an agent.

### OSW-TSK-022

> warning: {count} harness.json could not be read, so their items are resolved from the task text alone: {listed}.

Why: A change's taskAgents configuration is unreadable, so its delegation is read from task text alone.

What to do: Fix the change's harness.json so its delegation is read.

### OSW-TSK-023

> warning: 1 key that signs a run waits to be enrolled.

Why: A key that signs a live run is not enrolled, so a person must confirm it was them.

What to do: Enrol the key from the change's card or the team surface.

### OSW-TSK-024

> warning: {count} keys that sign runs wait to be enrolled.

Why: Keys that sign live runs are not enrolled, so a person must confirm each one.

What to do: Enrol the keys from the changes' cards or the team surface.

### OSW-TSK-025

> warning: 1 question from an agent waits for your answer.

Why: An agent's question holds a run until the operator answers it.

What to do: Answer the question on the change's card or in decisions.md.

### OSW-TSK-026

> warning: {count} questions from agents wait for your answer.

Why: Agents' questions hold runs until the operator answers them.

What to do: Answer the questions on the changes' cards or in decisions.md.

### OSW-TSK-027

> warning: {count} taskAgents entry(ies) matched no open task: {listed}.

Why: A change's taskAgents names agents for tasks that are not open, so the configuration has gone stale.

What to do: Remove or correct the taskAgents keys named.

### OSW-TSK-028

> error: What is waiting could not be read: {reason}.

Why: The inbox read failed, so what is waiting is unknown rather than empty.

What to do: Read the reason, fix what it names, and reload the inbox.

### OSW-TSK-029

> error: {ending} {item} came back ticked with nothing written, so the tick was reverted and the run is refused.

Why: A delegated run ticked its item while adding no evidence, so the rubber-stamp gate rolled the tick back.

What to do: Read the run's reply, write the evidence, then tick the item or run it again.

### OSW-TSK-030

> info: {ending} {item} is ticked and its text carries more than it did. Something was recorded; whether it is true was not checked.

Why: A delegated run ticked its item and wrote something, which the narrow gate accepts without judging truth.

What to do: Read what was recorded and judge whether it is the evidence the task asked for.

### OSW-TSK-031

> warning: {ending} {item} could not be found again afterwards, so nothing was compared: {reason}.

Why: The item moved or vanished after the run, so the gate reports that it could not compare rather than assuming.

What to do: Find the item and compare its text with what the run wrote.

### OSW-TSK-032

> warning: {ending} {item} is still open.

Why: The delegated run ended without ticking the item it was asked to close.

What to do: Read the run's reply and close the item, or run it again.

### OSW-TSK-033

> warning: no open task numbered {task} is left in {change}/tasks.md

Why: The task the gate compares by number is no longer open in tasks.md after the run.

What to do: Check whether the task was closed, renumbered or removed during the run.

### OSW-TSK-034

> warning: line {line} of {change}/tasks.md is no longer a checklist item

Why: The item's line no longer holds a checklist item after the run.

What to do: Check what the run changed around that line.

### OSW-TSK-035

> error: the item became ticked while saying nothing it did not say before

Why: The run ticked the item without writing any new evidence, so the gate reverts the tick.

What to do: Read the run's reply, write the evidence, and tick the item.

### OSW-TSK-036

> warning: {reason}. It last said: {said}

Why: A failed or cancelled run ended for the given reason, and the end of its stderr is kept for the reader.

What to do: Read the last words and put right what stopped the run.

### OSW-TSK-101

> warning: a request to stop after {task} named a task this change does not have; the run goes on

Why: The stop named a task number the change's task list does not contain, and that cannot be read as either "stop now" or "never stop".

What to do: Check the task number against tasks.md and ask the run to stop after a task it actually has.

## VAL: validation, the merge gate, checks

### OSW-VAL-001

> error: "path-unchanged" requires a repository-relative path parameter

Why: The path-unchanged check was named in a task line without the repository-relative path it must watch.

What to do: Add the path after the check name, as in `path-unchanged: packages/core/src`.

### OSW-VAL-002

> error: path "{path}" resolves outside the workspace "{root}"

Why: A path-unchanged parameter resolved outside the workspace, which a check must never reach.

What to do: Correct the path in the task line so that it stays inside the workspace.

### OSW-VAL-003

> error: Unknown mechanical check "{name}" (expected one of: {names})

Why: A check name reached the runner that the closed registry does not contain, which is a host's fault rather than a person's.

What to do: Report it with the task line that named the check, since only the listed names may run.

### OSW-VAL-004

> error: No change named {change}

Why: A relation edit named a change the workspace does not have.

What to do: Use the id of a change that exists, refreshing the Pipeline if the name came from a card.

### OSW-VAL-005

> error: {change} is archived, and an archived change's relations are history

Why: A relation edit targeted an archived change, whose relations are fixed history.

What to do: Edit an active change's relations instead, or restore the change first.

### OSW-VAL-006

> error: {path} cannot be read as relations: {error}

Why: The change's metadata holds relation lines that the reader cannot parse.

What to do: Fix the follows, supersedes or blocked_by lines in the file by hand, then try the edit again.

### OSW-VAL-007

> error: The edit names no change to relate

Why: A relation edit arrived with neither a change to add nor one to remove.

What to do: Give the edit exactly one change to add or remove.

### OSW-VAL-008

> error: A change cannot state {key} on itself

Why: A relation edit would make the change state a relation on itself.

What to do: Name a different change.

### OSW-VAL-009

> error: No change named {change}, active or archived

Why: The change being added as a relation exists neither active nor archived.

What to do: Use the id of an existing change, or create that change first.

### OSW-VAL-010

> error: That would close a cycle: {cycle}

Why: The added relation would make the change graph circular, which the relation gate refuses.

What to do: Choose a relation that keeps the graph acyclic, following the named path.

### OSW-VAL-101

> error: openspec change validate --strict {change}: {count} item(s) failed ({ids})

Why: Strict OpenSpec validation of the change found items that do not hold.

What to do: Fix the items named, then run the check again.

### OSW-VAL-102

> info: openspec change validate --strict {change}: {count} item(s) passed

Why: Strict OpenSpec validation of the change passed every item.

What to do: Nothing.

### OSW-VAL-103

> error: openspec change validate --strict {change} failed to run: {error}

Why: The strict validation command could not be started or threw.

What to do: Fix the reported tooling problem, then run the check again.

### OSW-VAL-104

> error: npm run {script} failed to run: {error}

Why: An npm script that the check runs could not be started.

What to do: Fix the reported npm or script problem, then run the check again.

### OSW-VAL-105

> info: npm run {script} exited 0

Why: The npm script that the check runs finished successfully.

What to do: Nothing.

### OSW-VAL-106

> error: npm run {script} exited {code}:
{output}

Why: The npm script that the check runs finished with a non-zero exit code.

What to do: Read the output shown, fix what failed, then run the check again.

### OSW-VAL-107

> error: git diff -- {path} failed to run: {error}

Why: The git command behind the path-unchanged check could not be started.

What to do: Fix the reported git or filesystem problem, then run the check again.

### OSW-VAL-108

> info: git diff -- {path} reported no changes

Why: The watched path has no uncommitted changes, so the path-unchanged check passed.

What to do: Nothing.

### OSW-VAL-109

> error: git diff -- {path} reported uncommitted changes to "{path}"

Why: The path that the check must leave unchanged has uncommitted changes.

What to do: Commit, revert or move the changes at the named path.

### OSW-VAL-110

> error: git diff -- {path} exited {code}: {output}

Why: The git command behind the path-unchanged check exited with an unexpected code.

What to do: Read the output shown, fix what git reported, then run the check again.

### OSW-VAL-111

> error: no ".changeset/config.json" found under "{root}" — Changesets is not adopted

Why: The changeset-present check ran where Changesets is not adopted.

What to do: Adopt Changesets in the workspace, or remove that check from the task line.

### OSW-VAL-112

> error: no pending ".changeset/*.md" file found — run "npx changeset" for "{change}"

Why: The change has no pending changeset file, which the merge gate requires.

What to do: Run `npx changeset` and commit the file it writes.

### OSW-VAL-113

> info: {count} pending changeset file(s) found

Why: The changeset-present check found the pending files it requires.

What to do: Nothing.

### OSW-VAL-114

> error: requirement header "{header}" does not exist in the current specification

Why: A modified block names a requirement that the current specification no longer carries.

What to do: Update the change's modified block to the header the current specification carries.

### OSW-VAL-115

> error: scenario "{scenario}" under requirement "{header}" exists in the current specification but is omitted from this change's modified block

Why: The current specification has a scenario that the change's modified block omits.

What to do: Add the scenario to the modified block, or remove it from the specification.

### OSW-VAL-116

> error: {change}'s tasks.md names "Successor created: `{successor}`" but no change `{successor}` states `follows: {change}`

Why: A change's tasks.md promised a named successor that no change of that id follows.

What to do: Create the successor with the relation stated, or correct the claim in tasks.md.

### OSW-VAL-117

> info: Nothing recorded yet — no runs have been logged in this workspace.

Why: The audit log has no entries, so there is no verify quality to report.

What to do: Nothing.

### OSW-VAL-118

> info: Nothing to report yet — {runs} runs recorded, none of which reached a verifying stage that reported what its checks found.

Why: Runs are recorded, but none reached a verify stage that reported what its checks found.

What to do: Nothing.

### OSW-VAL-119

> info: {stages} verifying stage(s) recorded, none of which names the agent whose work was checked. They were recorded before that was written down, so none is charged to an agent.

Why: The verify stages were recorded before the field naming the checked agent existed, so none is charged to an agent.

What to do: Nothing, newer verifies record the agent whose work was checked.

### OSW-VAL-120

> info: {stages} verifying stage(s) across {agents} checked agent(s){thinClause}{unnamedClause}

Why: The verifying stages and their failures are reported per checked agent, with thin groups and unattributed entries named.

What to do: Read the rows, and gather more verifies before trusting a thin group's rate.

### OSW-VAL-121

> error: mechanical checks failed, verifying agent was not invoked: {summary}

Why: A declared mechanical check failed at verify, and the chain deliberately spends no verifying run to learn what an exit code already said.

What to do: Put right what the named checks reported (or finish the tasks they uncheck), then run the change again.

## ARC: archiving

### OSW-ARC-001

> error: initOpenSpec requires at least one tool

Why: `initOpenSpec` was called with a tools list that held no usable name.

What to do: Pass at least one tool name, or skip initialization.

### OSW-ARC-002

> error: OpenSpec CLI returned {kind} JSON for '{command}'. Expected {contract}. Update OpenSpec CLI or OpenSpec Workbench to compatible versions.

Why: The `openspec` CLI answered a command with JSON this Workbench cannot read.

What to do: Update the OpenSpec CLI or OpenSpec Workbench so their versions agree.

### OSW-ARC-003

> error: {binary} {args} exited with code {code}: {reason}

Why: The `openspec` command exited non-zero, and its own diagnosis is quoted after the code.

What to do: Read the diagnosis and put right what it names, then retry.

### OSW-ARC-004

> error: could not archive "{change}": it still owes {debts}

Why: Archiving is refused unless every task item is closed and anything closed has something written under it (a-change-is-archived-with-nothing-open).

What to do: Finish the named tasks, writing a note under each closed one, then archive again.

### OSW-ARC-005

> error: the archive did not happen, and no reason was given

Why: The archive result carried neither an archived change nor any status entries to explain it.

What to do: Run `openspec archive` by hand to see what it says.

### OSW-ARC-006

> error: the archive did not happen, and the report gave no reason

Why: The archive's status entries held no error message or code that could be reported.

What to do: Run `openspec archive` by hand to see what it says.

### OSW-ARC-007

> error: could not archive "{change}": {refusal}

Why: The archive subcommand refused, and its reasons and remedies are reported together.

What to do: Do what the refusal's reason and fix say, then archive the change again.

### OSW-ARC-101

> error: archiving changed nothing, so there was nothing to commit

Why: After archiving, git had staged nothing, so the branch would carry no archive.

What to do: Find why the archive changed no file, then run the sweep again.

### OSW-ARC-102

> error: {forge} could not be asked about pull requests: {reason}

Why: The forge could not be asked about pull requests, so the pass cannot know what is due or already open.

What to do: Fix the forge access the reason names, then sweep again.

### OSW-ARC-103

> warning: its checks could not be read: {reason}

Why: An open archive pull request's checks could not be read, so it cannot be merged yet.

What to do: Nothing; the next pass reads them again.

### OSW-ARC-104

> warning: a check failed

Why: A check on the archive pull request failed, so the sweep will not merge it.

What to do: Read the failed check and fix or re-run it.

### OSW-ARC-105

> error: no merge method was tried

Why: No merge method was available to try, so the archive pull request was left unmerged.

What to do: Report it; a merge method should always be tried.

### OSW-ARC-106

> error: {forge} refused the merge: {reason}

Why: The forge refused every merge method tried for the archive pull request.

What to do: Read the forge's reason and put right what it names, then wait for the next pass.

### OSW-ARC-107

> error: {reason}; making it again on {ref} failed too: {failure}

Why: The forge refused the merge and the rebuilt archive could not be pushed to its branch either.

What to do: Fix what the second failure names, then sweep again.

### OSW-ARC-108

> error: no reason given

Why: A failure carried no message or telling git line that could be quoted.

What to do: Run the command by hand to see why it failed.

### OSW-ARC-201

> info: opened #{number} to archive {changes}, which landed with nothing open

Why: The sweep found changes that landed with every task closed, and opened one pull request to archive them.

What to do: Nothing; the sweep follows it and merges it once its checks pass.

### OSW-ARC-202

> info: #{number} is merged by the sweep once its checks pass

Why: The sweep merges the archive pull request itself rather than asking the forge to do it later.

What to do: Nothing; wait for the checks.

### OSW-ARC-203

> info: merged #{number} by {method}: its checks passed, or none ran

Why: The archive pull request's checks had decided, or none ran, so the sweep merged it.

What to do: Nothing.

### OSW-ARC-204

> info: #{number} is waiting for its checks

Why: The archive pull request's checks are still running.

What to do: Nothing; the next pass reads them again.

### OSW-ARC-205

> warning: #{number} was refused while {behind} {commits} behind the default branch, so the archive was made again on it and pushed; its checks run again

Why: A forge that merges only what is up to date refused the branch, so the archive was rebuilt on the default branch.

What to do: Nothing; wait for the new checks.

### OSW-ARC-206

> warning: #{number} cannot merge yet: {reason}

Why: The archive pull request is blocked, usually by a failed check or the forge's refusal.

What to do: Read the reason and put right what it names.

### OSW-ARC-207

> warning: could not archive {change}: {reason}

Why: One change's archive failed while the pass was making the archive.

What to do: Read the reason and archive that change again.

### OSW-ARC-208

> error: {change} landed in #{number} but still owes {owed}, so it stays live: {owes}

Why: A change landed while its task list still owed something, which the merge gate should have prevented.

What to do: Report it, then close the named tasks or reopen the change.

### OSW-ARC-209

> error: nothing was archived: {failed}

Why: The pass could not make an archive pull request at all.

What to do: Read the reason and fix what it names, then sweep again.

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

## WSP: the workspace: setup, lease, locks

### OSW-WSP-001

> error: Another OpenSpec Workbench host ({hostKind} on {hostname}, pid {pid}{author}, last active {seconds}s ago) is currently running a mutating operation on this workspace. Wait for it to finish, or close it, before starting one here.

Why: A live foreign host holds this workspace's lease, and only one mutating operation may run against a workspace at a time (ADR 0010).

What to do: Wait for the named host to finish or close it, then start the operation again.

### OSW-WSP-002

> error: the holder is on {holderhostname} and this is {thishostname}, so whether its process is still running cannot be checked from here. Clear it there, or wait for its lease to go stale.

Why: A lease held on another machine cannot be shown to be dead from this one, so clearing it here could rob a running holder.

What to do: Clear the lease on the machine named, or wait for its heartbeat to go stale.

### OSW-WSP-003

> error: process {pid} is still running. Taking its lease would let a second mutating run start against files it still has open, which is what the lease prevents — stop that process instead.

Why: The holder's process is still alive on this machine, so releasing its lease would let two mutating runs touch the same files.

What to do: Stop the process named, or wait for it to end, then clear the lease.

### OSW-WSP-004

> warning: "{name}" is not a valid change name

Why: A working directory was asked for a change whose name no change may have, so no branch or directory of that name can be made.

What to do: Name the change as its folder under openspec/changes is named.

### OSW-WSP-005

> warning: "{name}" is not in {base}

Why: The change exists only as uncommitted files, and the working directory is cut from a base that does not contain it.

What to do: Commit the change's directory to the base first, or name a base that has it.

### OSW-WSP-006

> warning: branch "{name}" is already checked out at {path}

Why: A branch can be checked out in only one working directory, and this change's branch already has one.

What to do: Run the chain in that directory, or remove it first.

### OSW-WSP-007

> warning: {path} already exists

Why: The place a working directory would be created is already occupied, so creating it would touch something this product did not make.

What to do: Remove it, or pass another path.

### OSW-WSP-008

> warning: branch "{name}" already exists, with no working directory on it

Why: Removing a working directory leaves its branch behind, and git would otherwise refuse with a reason that says nothing about what to do.

What to do: Check the branch out where it is wanted, or delete it if its work has landed.

### OSW-WSP-009

> warning: the working tree is not clean

Why: A directory whose tree is dirty may still hold uncommitted work, and removing it has no undo.

What to do: Commit or discard the uncommitted changes, then ask for the removal again.

### OSW-WSP-101

> info: Reclaimed the workspace lease from {hostKind} on {hostname} (pid {pid}), which stopped renewing it {seconds}s ago.

Why: A previous holder stopped heartbeating, so this run took the workspace from it rather than waiting forever.

What to do: Nothing, unless that holder was expected to be alive: a reap of a live holder's lease is the one case worth checking by hand.

### OSW-WSP-102

> warning: it is not a directory

Why: A path the repository lists as a working directory is not a directory, so its changes, task lists and lease cannot be read.

What to do: Look at the path the worktree list names, and repair or prune it.

### OSW-WSP-103

> warning: it does not exist

Why: A worktree the repository lists has no directory at its path, so nothing of it can be surveyed.

What to do: Run `git worktree prune`, or restore the missing directory.

### OSW-WSP-104

> error: {said}. No process names this directory on its command line; one that holds it without naming it is not found this way.

Why: A removal failed and no process naming the directory was found, so the underlying reason is all that can be said.

What to do: Look for a program holding the directory without naming it on its command line, then remove it again.

### OSW-WSP-105

> error: {said}. Held by {holders}, by their command lines.

Why: A removal failed and processes whose command lines name the directory were found, so the message says who may be holding it.

What to do: Stop the processes named, then remove the directory again.

## KEY: signatures, keys, the team

### OSW-KEY-001

> error: Agent "{agent}" is not present in the workspace allowlist

Why: The workspace allowlist names no rule for this agent, so nothing it asks to run is permitted.

What to do: Add the agent to the workspace allowlist, or choose an agent that is already on it.

### OSW-KEY-002

> error: Agent "{agent}" is not permitted to run in process

Why: The agent's allowlist rules carry no in-process rule matching its own name.

What to do: Add an in-process rule for the agent, or run it as a spawned executable.

### OSW-KEY-003

> error: HTTP call is not permitted by the allowlist for agent "{agent}"

Why: The agent's rules carry no HTTP rule, so the call it asked for cannot be made.

What to do: Add an HTTP rule for the agent, or use an agent that reaches the model another way.

### OSW-KEY-004

> error: URL/method "{method} {url}" is not permitted by the allowlist

Why: The agent's HTTP rule allows other URLs or methods than the one this call names.

What to do: Extend the rule to the URL and method, or change the call.

### OSW-KEY-005

> error: Executable "{executable}" is not permitted by the allowlist for agent "{agent}"

Why: The agent asked to spawn an executable that no rule of its allowlist names.

What to do: Add the executable to the agent's rules, or have it use one already permitted.

### OSW-KEY-006

> error: Arguments [{arguments}] are not permitted by the allowlist

Why: The executable is permitted, but its rules refuse the arguments this invocation carries.

What to do: Bring the invocation within the rule's arguments, or widen the rule.

### OSW-KEY-007

> error: cwd "{cwd}" is outside the workspace "{workspace}"

Why: The run's working directory resolved outside the workspace root, and the cwd sandbox refuses it.

What to do: Run from a directory inside the workspace.

### OSW-KEY-008

> error: it is not valid JSON

Why: A person's file could not be parsed, so nothing in it can be trusted.

What to do: Fix the file's JSON, then read the team again.

### OSW-KEY-009

> error: it is not a JSON object

Why: A person's file parses to something other than an object with named fields.

What to do: Make the file a JSON object with handle, name and keys.

### OSW-KEY-010

> error: its handle is missing or not lower-case letters, digits and single hyphens

Why: A person is named by a handle a forge would accept, and this file's handle is not that shape.

What to do: Give the file a handle of lower-case letters, digits and single hyphens.

### OSW-KEY-011

> error: its file is not named after its handle ({handle}.json)

Why: The file name must be the handle, so that two files cannot claim one handle.

What to do: Rename the file to the handle it declares.

### OSW-KEY-012

> error: it has no name

Why: Every person is shown by a name, and this file leaves it empty.

What to do: Add the person's name to the file.

### OSW-KEY-013

> error: it lists no key

Why: A person with no key can sign nothing, so their file is unusable.

What to do: Add at least one public key to the file.

### OSW-KEY-014

> error: {key} is not a JSON object

Why: One entry in the keys list is not an object with a key id, public key and added date.

What to do: Make that key entry a JSON object.

### OSW-KEY-015

> error: {key} is not an Ed25519 public key with its key id

Why: The entry's public key and key id do not match, so signatures made with it cannot be verified.

What to do: Re-add the key from the machine that holds it.

### OSW-KEY-016

> error: {key} has no date it was added

Why: Every key records when it was added, and this one has no readable date.

What to do: Give the key an addedAt date in ISO form.

### OSW-KEY-017

> error: {key} has a retirement date that is not a date

Why: A retirement date is only read as an ISO date, and this one is not one.

What to do: Correct the retiredAt date, or remove it.

### OSW-KEY-018

> error: {key} names its machine with something other than text

Why: The optional machine field must be text a person can read.

What to do: Make the machine field text, or remove it.

### OSW-KEY-019

> error: its e-mail addresses are not a list of addresses

Why: The optional emails field must be a list of strings that each look like an address.

What to do: Correct the e-mail list, or remove the field.

### OSW-KEY-020

> error: key {keyId} is also {handle}'s

Why: One key id appears in two people's files, so either could sign as the other.

What to do: Remove the duplicate key from one file and give that person their own.

### OSW-KEY-021

> error: a person is never removed: their signatures would stop verifying

Why: A pull request that deletes a person's file would leave everything they signed unverifiable.

What to do: Keep the file and retire the keys that are no longer used.

### OSW-KEY-022

> error: key {keyId} was removed; retire it with retiredAt instead

Why: A key is never taken out of a person's file, because what it signed must keep verifying.

What to do: Put the key back and set its retiredAt date.

### OSW-KEY-023

> error: key {keyId} was replaced

Why: Changing a recorded public key would make everything it signed fail to verify.

What to do: Restore the original key and add the new one alongside it.

### OSW-KEY-024

> error: key {keyId}'s retirement was changed

Why: A retirement already recorded is history, and changing it rewrites when a key stopped being used.

What to do: Restore the recorded retirement date.

### OSW-KEY-025

> error: "{handle}" is not a handle: use lower-case letters, digits and single hyphens

Why: Joining the team takes a handle of the shape a forge accepts, and this one is not that shape.

What to do: Choose a handle of lower-case letters, digits and single hyphens.

### OSW-KEY-026

> error: a name is needed

Why: A person joins under a name others can read, and none was given.

What to do: Pass the name along with the handle.

### OSW-KEY-027

> error: this machine's key is already {handle}'s

Why: This machine's key can belong to only one person, and it is already in another's file.

What to do: Join under that handle, or make a new key for this person.

### OSW-KEY-028

> error: {file} cannot be read: {problems}

Why: The person's existing file has problems, so this machine's key cannot be added to it.

What to do: Fix the problems listed in that file, then join again.

### OSW-KEY-029

> error: no live run signed by {keyId} is waiting to be enrolled

Why: Confirmation enrols only a key that signs a live record now, so a confirmation is always about a run somebody can see.

What to do: Enrol a key id that a live run's record is signed with.

### OSW-KEY-030

> error: the key at {file} is not an Ed25519 key

Why: The private key file holds a key of another type, which this product does not sign with.

What to do: Remove or move the file so that a fresh Ed25519 key is made.

### OSW-KEY-031

> error: the key at {file} was removed as it was made

Why: Two writers made a key at once and the private file vanished before it could be read.

What to do: Try again; report it if the key file keeps disappearing.

## NET: network, proxy, the local LLM

### OSW-NET-001

> warning: {token} is not set

Why: The forge's token was not in the environment, so the forge cannot be reached.

What to do: Set the named token in the environment, then read the pull requests again.

### OSW-NET-002

> error: the {token} was refused (401)

Why: The forge answered the token with 401, so the credentials are wrong or expired.

What to do: Replace the named token, then read the pull requests again.

### OSW-NET-003

> error: {method} {path} answered {status}: {reason}

Why: The forge refused the request and said why in its own words.

What to do: Read the forge's reason and put right what it names, then try again.

### OSW-NET-004

> warning: gh is not installed

Why: `gh` is not on PATH, so GitHub cannot be read through it.

What to do: Install `gh`, or set GITHUB_TOKEN to reach GitHub over its API.

### OSW-NET-005

> warning: no remote is on a GitHub host gh knows

Why: `gh` was asked about a repository whose remote it cannot place on GitHub.

What to do: Point `origin` at a GitHub host `gh` knows, or set GITHUB_TOKEN.

### OSW-NET-006

> warning: gh is not signed in

Why: `gh` has no credentials for this host, so it answered with an auth error.

What to do: Run `gh auth login`, or set GITHUB_TOKEN.

### OSW-NET-007

> warning: {reason}, and GITHUB_TOKEN is not set

Why: `gh` could not reach GitHub and no API token was set either.

What to do: Install or sign in to `gh`, or set GITHUB_TOKEN.

### OSW-NET-008

> error: gh failed: {reason}

Why: `gh` exited non-zero and gave a reason of its own.

What to do: Read what `gh` said and put it right, then read the pull requests again.

### OSW-NET-009

> error: gh printed something that is not JSON

Why: `gh` answered the pull-request list with output the product cannot parse.

What to do: Check the installed `gh` version and report the output if it persists.

### OSW-NET-010

> error: gh printed something that is not a list

Why: `gh` answered the pull-request list with JSON that is not a list.

What to do: Check the installed `gh` version and report the output if it persists.

### OSW-NET-101

> info: checks are still pending

Why: At least one check has not finished, so the answer is not final yet.

What to do: Wait; the product asks again until the checks decide.

### OSW-NET-102

> warning: no check result was available

Why: The forge reported no checks, so nothing vouches for the change.

What to do: Add a check, or merge by hand once you are satisfied.

### OSW-NET-103

> error: check failed: {check} ({state})

Why: One check finished in a state that is neither a pass nor pending.

What to do: Read that check's log and put right what it reports.

### OSW-NET-104

> warning: every check was skipped — no check actually ran

Why: Checks exist but none of them decided anything, which ADR 0014 treats as no evidence.

What to do: Run a check that actually exercises the change, then try again.

### OSW-NET-105

> warning: Gitea did not say which commit the pull request is at

Why: Gitea's answer carried no head commit, so its checks cannot be read.

What to do: Check the pull request in Gitea, then try again.

### OSW-NET-106

> warning: GitHub did not say which commit the pull request is at

Why: GitHub's answer carried no head commit, so its checks cannot be read.

What to do: Check the pull request on GitHub, then try again.

### OSW-NET-201

> warning: checks did not reach a terminal state before timeout

Why: The checks were still pending when the wait ran out.

What to do: Look at why the checks are slow, or raise maxWaitMs.

### OSW-NET-202

> warning: Stopped at the {calls}-web-tool-call limit.

Why: The local model asked for more web-tool calls than the product allows.

What to do: Raise the web-tool-call limit, or narrow the request.

### OSW-NET-203

> warning: Stopped at the {iterations}-iteration web-tool limit.

Why: The local model used every web-tool iteration the product allows.

What to do: Raise the web-tool-iteration limit, or narrow the request.

### OSW-NET-204

> info: The local LLM's server refused the key. Set the key the server expects (the local LLM settings, or OPENSPEC_UI_LOCAL_LLM_API_KEY), then start the run again.

Why: The local LLM's server refused the key the run offered it.

What to do: Set the key the server expects in the local LLM settings or OPENSPEC_UI_LOCAL_LLM_API_KEY, then start the run again.

### OSW-NET-205

> info: The agent could not reach its service. Check the address and the connection. Where a system proxy is in the way, turn on openspec-ui.agents.ignoreSystemProxy in the editor, or set OPENSPEC_UI_IGNORE_SYSTEM_PROXY=1 for the server and the CLI.

Why: The agent could not reach its service, and a system proxy is a common cause.

What to do: Check the address and the connection; where a proxy is in the way, turn on the ignore-system-proxy setting.

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

### OSW-CLI-017

> error: {command} refused: {reason}

Why: The requested subject is absent or a core policy prevents the action.

What to do: Read the stated reason; inspect the change, run or workspace before retrying.

### OSW-CLI-018

> error: {command} could not complete: {reason}

Why: Arguments, configuration or an underlying reader prevented the command from completing.

What to do: Correct the arguments or the reported configuration/tooling problem and retry.

## PRC: spawned processes: orphaned, overdue, terminated

### OSW-PRC-001

> error: the live process start time could not be read; refusing

Why: A process's identity cannot be re-verified without its operating-system start time.

What to do: Check that the PID still names this product's process, then retry once the system can read it.

### OSW-PRC-002

> error: no start time was recorded for this process; refusing

Why: The process was spawned but its start time was never captured, so its identity is incomplete.

What to do: Terminate it by hand if it is safe to, after confirming what it is.

### OSW-PRC-003

> error: the recorded start time is invalid

Why: The snapshot holds a start time the system cannot read as a date.

What to do: Report it; the snapshot's file is corrupt.

### OSW-PRC-004

> error: the live start time differs from the recorded one (PID reuse)

Why: The operating system has reused this PID for a different process.

What to do: Do nothing to it; the recorded process is gone.

### OSW-PRC-005

> error: recorded on {host}, this host is {local}

Why: The snapshot belongs to another machine, whose PID space is unrelated to this one.

What to do: Terminate it on that machine, not here.

### OSW-PRC-006

> warning: the process ledger is not configured

Why: No shared state root has been set, so spawned processes are not recorded.

What to do: Start the Workbench normally; report it if a fresh activation still says this.

### OSW-PRC-007

> info: no recorded process is still detached

Why: Every recorded process has exited, so nothing outlived a host restart.

What to do: Nothing.

### OSW-PRC-008

> warning: terminate {executable} (pid {pid})? its start time is re-verified first, then the whole process tree is killed

Why: Terminating a process is irreversible, so the confirmation names what will be killed.

What to do: Confirm only for a process this product started, then terminate it.

### OSW-PRC-009

> error: termination refused — {reason}

Why: The snapshot no longer matches the live process, so the kill was not issued.

What to do: Read the reason; do not force the kill.

### OSW-PRC-010

> info: terminated {label}

Why: A confirmed process tree was killed after its identity re-verified.

What to do: Nothing.
