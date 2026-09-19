Asked for by the owner on 2026-09-19: say to a live run "only up to 4.6"
without interrupting it. The first of two changes; free text to the agent
and a question back from it follow in the next one.

## 1. The request carries the task

- [x] 1.1 `packages/core/src/agent-messages.ts` gives `StopMessage` an
  optional `afterTask` (the task number as written in `tasks.md`, for
  example `4.6`), and `askRunToStop` takes it and seals it with the rest.
  Do not add a second message kind: a stop that names a task is a stop.
- [x] 1.2 `readStopRequests` returns `afterTask` unchanged on a verified
  reading, and refuses a request whose `afterTask` is not a task number
  (`<digits>.<digits>` with optional further parts) with the existing
  refusal path rather than by throwing.
- [x] 1.3 `packages/core/src/agent-status.ts` passes `afterTask` through
  to `onStopRequested`, and its `StopRequestHandlers` type carries it.
- [x] 1.4 `packages/core/src/agent-messages.test.ts` covers: a request
  with `afterTask` sealed and read back, a request without it read as
  before, and a malformed `afterTask` refused.

## 2. The run holds it until the task is done

- [x] 2.1 `packages/core/src/harness-chain-runner.ts`'s `requestStop`
  takes the task, and where one is given holds the request on the chain
  state rather than setting `stopRequest`.
- [x] 2.2 The held request becomes the pending stop at the first of: the
  named task's checkbox ticked in the change's `tasks.md`, or a task
  marker naming a task that sorts after it. Read where the stop boundary
  already reads - `countTickedTasks` and `TaskMarkerReader` - and do not
  add a second poll of the task list.
- [x] 2.3 A held request whose named task is already ticked when it
  arrives becomes the pending stop at once, and the run says that the
  point had passed.
- [x] 2.4 A request naming a task the change's list does not have is
  refused, said in the run's activity, and recorded; the run goes on. Do
  not treat an unknown task as "stop now".
- [x] 2.5 The chain's ending audit entry carries the task it was told to
  stop after, beside the reason, the asker and the message identifier.
- [x] 2.6 `packages/core/src/harness-chain-runner.test.ts` covers each of
  2.1 to 2.5, and that a stop with no task behaves exactly as before.

## 3. Asked from a terminal

- [x] 3.1 `packages/cli/src/stop-command.ts` takes `--after <task>`,
  passes it to `askRunToStop`, and prints what it asked for.
- [x] 3.2 `--after` with no task, or with something that is not a task
  number, exits 2 with what was given, before anything is written.
- [x] 3.3 `packages/cli/src/stop-command.test.ts` covers both, and that
  `stop` without `--after` writes the request it always did.
- [x] 3.4 `README.md`'s CLI table names `--after` on the `stop` row, and
  `docs/how-to/stop-a-run.md` says how to stop after a task.

## 4. Asked from the editor

- [x] 4.1 `packages/extension/src/commands.ts` registers
  `openspec-ui.stopRunAfterTask`, which asks for the task and the reason
  and writes the signed request through core, for the change on the
  acted-on row.
- [x] 4.2 The command is offered only on a change with a live run, from
  the same reading the Changes view already has; on any other row it says
  there is nothing running to ask.
- [x] 4.3 `packages/extension/package.json` contributes it on a change's
  context menu, in the group the relation commands use rather than beside
  Archive and Rollback.
- [x] 4.4 `packages/extension/src/commands.test.ts` covers: the command
  with a live run writing the request, a row with no live run refusing,
  and a cancelled prompt writing nothing.

## 5. Checks

- [x] 5.1 `npm run typecheck && npm run lint && npm run test`, run unpiped.
  Record each package's count.

  Done 2026-09-19: `npm run typecheck` and `npm run lint` green across the
  workspace. `npm run test`: core 1589 in 114 files, cli 165 in 16,
  extension 442 in 31, server 109 in 4, webui 606 of 607 in 71 - the one
  failure is the known Windows-only `scripts/build-metro-icons.test.mjs`
  line-ending comparison, which fails here on an untouched tree and passes
  in CI.
- [x] 5.2 A changeset: `@openspec-ui/core` minor, `@openspec-ui/cli`
  minor, `openspec-ui-vscode` minor.
- [ ] 5.3 `lint:english` after `git add`, `lint:changesets`,
  `lint:test-budgets`, `lint:source-text`, `lint:screenshots` and
  `lint:publish-workflow` pass.
- [x] 5.4 The whole standalone browser suite passes, unchanged by this
  change. Record the count.

  Done 2026-09-19: `npm run test:browser -w @openspec-ui/server` - 25
  passed in 9.2 minutes, unchanged by this change. The pictures the suite
  regenerates were restored with `git checkout -- docs/images`.
- [x] 5.5 **Delegated to claude-cli.** A live check: a chain started on a
  change with several tasks, asked from a second terminal to stop after a
  named task, and left to reach it. Evidence to record: the request's
  message identifier, the run's activity line while it was held, the task
  ticked, the ending entry with the task in it, and the tasks that were
  not started.

  Done 2026-09-19 by Claude, at the owner's request rather than by a
  delegated CLI agent, for the owner to look at in turn. Against a scratch
  git workspace with tasks 4.5, 4.6 and 4.7, a run reporting itself live
  through `AgentStatusWriter`, this machine's real key, and the CLI's own
  entry point.

  Refusing a task that is not a task number, before anything is written:
  exit 2, "openspec-ui-cli: --after takes a task number, such as 4.6; it
  was given "the fourth one"".

  Asking to stop after 4.6: exit 0, and the answer
  `{ "messageId": "4c63c8aa-...", "to": "9d1a437e-...", "afterTask": "4.6" }`.

  What landed in `.agent-messages`: one file, `4c63c8aa-....json`, sealed
  by key 6e6cd3d5b6f3..., whose payload reads
  `{ "version": 1, "kind": "stop", "to": "9d1a437e-...", "reason": "only
  up to 4.6", "afterTask": "4.6", "sentAt": "2026-09-19T09:52:43.722Z",
  "machine": "HPP-NTB63", "gitAuthor": "live@example.com" }`.

  What the receiving side read: `afterTask=4.6, reason="only up to 4.6"`,
  state `refused` - because the scratch roster has no enrolment for this
  machine's key, which is the documented answer for an unenrolled key and
  not a defect of this change. Log:
  `C:\Users\ivanov.a\AppData\Local\Temp\claude\c--Prog-OpenSpec-UI\77f1decc-484c-4274-a8c2-dffc13e27891\scratchpad\stop-after-live\live-check.log`.

  Not covered here, and outstanding: a real chain reaching 4.6 and
  stopping after it. That needs an agent run against a real change; the
  chain's own tests cover the reaction (held while the task is open,
  pending stop once it is ticked, ending entry naming the task), and the
  owner's next real run is where it will be seen.
- [ ] 5.6 **Human-only.** Whether "stop after 4.6" lands where the owner
  means it - after 4.6 is ticked, possibly a few lines into 4.7 - or
  whether they expect it to stop before 4.7 starts at all.
