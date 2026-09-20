## Why

The owner asked on 2026-09-19 for the other half of the conversation a run
can have. A run can already be told to stop, and to stop after a named task
(`a-run-is-told-where-to-stop`). It cannot be told anything else, and it
cannot say anything back.

What the owner wants to do without interrupting the work:

- leave a remark the run should take into account from here on;
- ask the run something and get an answer;
- see the answer, and any message meant for them, without watching a log.

Everything the channel needs is already built. ADR 0028's signed directory
carries a `stop` message: written beside `.agent-status`, sealed with the
sender's machine key, read by the run it names at every status renewal,
refused where it is unverified, stale or already seen. What is missing is
more than one thing to say.

## What Changes

- **Three more kinds of message**: `note` (words the run should take into
  account, expecting no reply), `ask` (words that expect one) and `answer`
  (the run's reply). Each is sealed, addressed and refused by the same
  rules as `stop`.
- **A message says who wrote it**: `author` is `person` or `run`. Only the
  roster says *which* person or run; `author` says what kind of sender
  claimed to write it, so a receiver can refuse a whole class without
  reading the words.
- **A run delivers what it was told to its agent** at the next stage it
  starts, in the stage's prompt context, and records in its audit what was
  said and by whom.
- **An `ask` is answered** when that stage ends: the run writes an `answer`
  addressed to the person who asked, carrying what the agent said.
- **An answer is shown**: the editor reads the person's own side of the
  channel and tells them what a run said, naming the stage and the run it
  came from.
- **A run does not take messages from another run** unless its harness
  configuration says it may. A person's messages are always taken.

## Capabilities

### Modified Capabilities

- `execution-core`: the signed channel carries a conversation, not only a
  stop, and a run delivers and answers.
- `vscode-extension`: a change with a live run can be spoken to, and what
  comes back is shown.

## Impact

- `packages/core`: `agent-messages.ts`, `agent-status.ts`,
  `harness-chain-runner.ts` and their tests.
- `packages/extension`: a command, a menu entry and a notification.
- `HARNESS.md` for the one new configuration key.
- A changeset for `@openspec-ui/core` and `openspec-ui-vscode`.

## Explicitly out of scope

- **A run asking a person a question on its own.** A run that needs
  something already suspends and says what it waits for, and the Human-Only
  Inbox already shows it. Giving it a second way to ask before that one is
  understood would be two mechanisms for one thing.
- **Listing answers in the Human-Only Inbox.** That inbox is built from one
  reading in core, over a change's own human-only items and the keys
  awaiting enrolment. An answer is neither, and giving the inbox a second
  source is a change of its own. An answer is told to the person when it
  arrives, which is what the owner asked for; where it should also be kept
  is worth deciding after they have lived with it.
- **Speaking to a run from the standalone app.** The Pipeline card's run
  controls are a protocol of their own and would need a kind and a dialog;
  the editor is where the owner asked for the menu item. The channel is in
  core, so the standalone host adds a control without a new channel.
- **Reaching an agent in the middle of a stage.** An agent reads its prompt
  when a stage starts. Anything else would mean a second input to a process
  already running, which no agent this product drives offers.
- **Inserting a task into `tasks.md` by message.** The owner raised it and
  withdrew it the same day. A note that says what to insert reaches the
  agent, which is the same effect without a second writer on the file.
