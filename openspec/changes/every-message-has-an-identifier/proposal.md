## Why

What the product says to a person - a failure's reason, a refusal, a CLI
error - is written where it is said, as a sentence. A person cannot look up
a message they saw, a host cannot act on one except by reading its words,
and nothing says which messages exist. ADR 0046, accepted by the owner on
2026-10-08, decides that every message is said as `<level>
OSW-<GROUP>-<NNN>: <message>`, from one register, and that the register
comes first with the groups `CLI`, `RUN`, `QST` and `PRM`.

## What Changes

- `message-register.ts` in core: the 14 groups, every message's identifier,
  level, words with named values, why it is said and what to do; `say`,
  `formatMessage`, `withMessageCode`, `messageEntryUrl`.
- `docs/messages.md`, generated from the register: a page a person
  searches for the identifier they saw.
- The `CLI`, `RUN`, `QST` and `PRM` messages are said from the register:
  the CLI's argument errors, the chain's refusals, limits and endings, the
  operator's questions, and the permission requests nobody can answer. Their
  words do not change; the CLI's lines lose `openspec-ui-cli:` and gain the
  form, `error OSW-CLI-003: --cwd requires a value`.
- `progress`, `failed` and `cancelled` events carry `code` beside their
  words, and so does the CLI's JSON. The CLI, the output channel and the
  panels put the identifier before the words; the panels show it as a label
  that links to its entry.
- Tests: identifiers well formed and in a group, every identifier ever
  given kept, the page what the register says, and a ratchet on the
  messages still said in place - 323 before, 290 after, and it may only
  fall.
- ADR 0046 amended: what the hundreds of a number mean, and how a message
  reads on a line of its own and after the mark of a run's end. ADR 0044,
  0045 and 0046 are marked Accepted, as the owner accepted them.

## Capabilities

### New Capabilities

- `messages`: every message has an identifier, from one register, said
  the same way everywhere, with a page that explains each.

### Modified Capabilities

None. The CLI's and the panels' words stay; what changes is said in
`messages`.

## Impact

- `packages/core`: `message-register.ts`, its test and the page's writer;
  `protocol.ts` (`code`); `harness-chain-runner.ts`,
  `operator-questions-runner.ts`.
- `packages/cli`: `main.ts`, `answer-command.ts`, `run-change.ts`,
  `stop-command.ts`, `task-command.ts`, `lease-command.ts`,
  `worktree-command.ts`, `update-plan.ts`, `render-run.ts`.
- `packages/extension`: `describe-event.ts`.
- `packages/webui`: `MessageCode.tsx`, `AiPanel.tsx`,
  `HarnessChainPanel.tsx`, the label's style.
- `docs/messages.md`, `docs/adr/0044`-`0046`, `docs/adr/README.md`.
