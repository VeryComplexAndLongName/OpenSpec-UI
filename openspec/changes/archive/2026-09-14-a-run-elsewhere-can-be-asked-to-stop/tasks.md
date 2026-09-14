A signed request to stop, read by the run it names at renewal and acted on
only when verified, fresh and new (ADR 0028, ADR 0029, ADR 0026 amendment).

## 1. The request

- [x] 1.1 `packages/core/src/agent-messages.ts` exports:
  - `agentMessageDirectory(root, mainPath)`, returning
    `<root>/<repo>/.agent-messages`, beside `agentStatusDirectory`;
  - `StopMessage { version: 1; messageId: string; kind: "stop"; to: string; reason: string; sentAt: string; machine: string; gitAuthor?: string }`;
  - `STOP_MESSAGE_STALE_AFTER_MS = 60_000`.

  Done, with `messageDirectoryBeside(statusDirectory)` beside them, as
  `rosterDirectoryBeside` is for the roster: a host that already holds a
  status directory finds the messages without resolving the repository
  again. Core's `index.ts` exports the module.
- [x] 1.2 `askRunToStop({ directory, to, reason, key, machine, gitAuthor })`
  seals the message with `sealEnvelope` and writes it to
  `<messageId>.json` through a temporary name and rename. It returns the
  `messageId`, a random UUID.

  Done. A temporary file that a failed rename leaves behind is removed.
  `now` and `messageId` are test seams.
- [x] 1.3 `readStopRequests({ directory, instanceId, roster, now, seen })`
  opens every file with `openEnvelope`, parses a payload only once its
  envelope opens, and keeps the payloads whose `to` is `instanceId`. It
  returns each kept message with one of these states:
  - `act`: verified, within `STOP_MESSAGE_STALE_AFTER_MS` of `sentAt`, and
    not in `seen`;
  - `refused`, with `why`: `unverified`, `stale` or `seen`.

  A file whose envelope does not check out is never parsed, so nothing says
  which run it is addressed to. `readStopRequests` returns nothing for it.
  Do not attribute it to whichever run happens to read it.

  Done. An `act` reading carries the enrolled `person`, whose label is the
  `by` a run records.
  - A refusal is decided in this order: unverified, then seen, then stale.
    A request dated more than the window ahead of `now` is stale too,
    since it was not made just now.
  - A payload that is not a well-formed stop message, or whose `messageId`
    is not its file name, is a request to nobody and is not returned.
  - Temporary files are not read. A file that vanishes between listing and
    reading is skipped.
- [x] 1.4 `readUnopenedRequests(directory, roster)` returns the file names of
  requests whose envelope does not check out. `openspec-ui-cli status`
  reports each one beneath the runs as
  `a request to stop that does not check out: <file>`.

  Done. `status` reads the roster and the messages beside the status
  directory it already resolved.
  - The line appears beneath the runs, and also after "No runs are
    reporting themselves." when nothing runs.
  - `--format json` adds `unopenedRequests` only where there is one, so a
    reading with none keeps its shape.
  - A request directory that cannot be read does not stop the runs being
    reported.

  `status-command.test.ts` has two new tests: the line beneath a run, and
  the line with nothing running plus the JSON field present and absent. The
  file passes, 21 tests.
- [x] 1.5 core `agent-messages.test.ts`:
  - a verified message for this instance is acted on;
  - the same message a second time is refused as `seen`;
  - a message 61 seconds old is refused as `stale`;
  - a message from an unenrolled key is refused as `unverified`;
  - a message with one changed byte is not parsed, is not returned for any
    instance, and is listed by `readUnopenedRequests`;
  - a message for another instance is not returned.

  Done: each of these is a test. A seventh reads a directory nobody has
  written to as holding no requests. The changed byte is flipped inside the
  signed payload, so the signature no longer verifies. The file passes, 7
  tests, and states its time budget. Core and cli typecheck, and lint is
  clean.

## 2. The run reads its requests

- [x] 2.1 `withAgentStatus` in `packages/core/src/agent-status.ts` gains a
  seam, `onStopRequested?: (request: { reason: string; by: string; messageId: string }) => void`.
  At each renewal, the writer calls `readStopRequests` for its instance and
  adds every returned `messageId` to its seen set. For each `act` message,
  it calls `onStopRequested` with the reason, the enrolled person's label,
  and the message id.

  Done. The seam reaches `AgentStatusWriter` through `startAgentStatusWriter`.
  - The writer's new `checkStopRequests()` is called on each renewal before
    the record is written, so the renewal carries what a request made the
    run say.
  - A writer given no `onStopRequested` reads no requests: a host that
    cannot stop its run is not asked to.
  - The roster and the message directory are read from beside the status
    directory, with test seams for both.
  - `AgentStatusStopRequestMessage` is the exported shape of a request.
- [x] 2.2 For each `refused` message, the writer sets the activity, once per
  message, to `a request to stop arrived, <why>; not acted on`. It also
  writes an audit entry with the run's `runId`, the message id and the
  reason for refusal.

  Done.
  - `<why>` is `not verified`, `stale` or `already read`, and the new
    activity is written at once.
  - The writer cannot reach an audit log, so it tells the host through a
    second seam, `onStopRequestRefused`. The host records an entry with
    outcome `message`, which no run counter reads. The entry carries the
    run's `runId`, its `changeDir`, and
    `stopRequestRefused { messageId, why }`, a new `AuditEntry` field.
  - The request's own reason is not copied into that entry: it was not
    verified to be anybody's words.
- [x] 2.3 Each host passes an `onStopRequested` that calls `requestStop` on
  the run it holds, with the request's reason and `by`. Record each junction
  as checked:
  - `packages/server/src/websocket.ts`;
  - the delegated item route in `packages/server/src/server.ts`;
  - `packages/cli/src/run-change.ts`;
  - `packages/extension/src/run-controller.ts`;
  - the chain start in `packages/extension/src/webview/ai-panel.ts`.

  Done, with one place in core that every host calls:
  `packages/core/src/stop-request-handlers.ts`.
  - `chainStopRequestHandlers` calls `requestStop` with the reason, the
    enrolled label as `by`, and the message id.
  - `agentStopRequestHandlers` sends a single-stage run's own runner a
    `stop` command with the reason. A `stop` command carries no `by`, so
    that runner reads its host's git identity, as a card's Stop already
    does. No command changes, as the design says.
  - Both record a refusal as in 2.2.

  Each junction, checked in the code, with typecheck passing:
  - **Server, `websocket.ts`.** A chain in `streamChainEvents`, a mutating
    single stage in `streamAgentEvents`, and any other single stage in
    `streamRun`. `server.ts` now passes its audit log to
    `handleSocketMessage`.
  - **The delegated item route.** It runs through `runDelegatedItem` in
    core, which now passes the agent handlers. The extension's inbox run
    goes through the same function.
  - **CLI, `run-change.ts`.** The chain handlers, with the run's audit log.
    `RunChangeDeps.createChainRunner` now requires `requestStop`, and the
    test's scripted chain has one.
  - **Extension, `RunController`.** It takes a `stopHandlers` factory.
    `extension.ts` passes one that picks the chain handlers for a `chain`
    command and the agent handlers otherwise.
  - **The chain start in `ai-panel.ts`.** It starts through
    `runController.run(chainRunner.asAgentRunner(), command)`, so its
    command's kind is `chain` and it gets the chain handlers.

  `stop-request-handlers.test.ts` has 4 tests: a chain's stop with `by`
  and message id, a chain's refusal entry without the unverified reason, a
  single stage's `stop` command, and its refusal under the run's agent.
  Core, cli, server and extension typecheck, and lint is clean. The
  touched suites pass: server 86, the extension's `run-controller` 8, the
  cli's `run-change` 12.
- [x] 2.4 After a stop acted on from a request, the chain's ending entry
  carries `stopRequest { reason, by }` and the request's `messageId`.

  Done. `requestStop` takes an optional `messageId`, the chain keeps it
  with the stop, and `recordEnding` writes it into `stopRequest`.
  `AuditEntry.stopRequest` gained the field. `harness-chain-runner.test.ts`
  has "carries a request's message id on the ending entry of a chain it
  stopped". The file passes, 103 tests.
- [x] 2.5 `sweepAgentStatuses` also removes message files whose modification
  time is older than `STOP_MESSAGE_STALE_AFTER_MS` plus the staleness
  window. Before removing a file, it checks the file's age again, as it does
  for records.

  Done. A file is removed only when its modification time is past the
  window, and still past it when read again just before removal. Whatever
  the sweep cannot read or remove is left. The sweep's result keeps its
  shape, so no caller changed.
- [x] 2.6 core `agent-status.test.ts`:
  - a verified request calls `onStopRequested` exactly once across two
    renewals;
  - an unverified request never calls it, and sets the activity line once;
  - a writer that has been stopped reads no requests.

  Done: "a request to stop this run" has these three tests, and a fourth in
  which a sweep removes a request past its window and keeps a fresh one.
  The unverified test also checks that `onStopRequestRefused` is called
  once, and that a later activity replaces the line. The file passes, 47
  tests.

## 3. Asking

- [x] 3.1 `openspec-ui-cli stop <instanceId> --reason <text>`, in
  `packages/cli/src/stop-command.ts`, reads the live records. It refuses an
  instance that has no live record, exiting non-zero and saying so.
  Otherwise it writes the request with this machine's key and prints the
  message id. Add a test.

  Done.
  - An instance id that no live record reports, or only a gone one or one
    that does not check out, exits 1 and says that nothing was asked.
  - A missing instance id or a blank reason exits 2, as does a status
    directory, key or file the command cannot use.
  - Otherwise it loads this machine's key and writes the request to the
    message directory beside the status directory, with the machine name
    and the configured git author.
  - It prints the message id, or `{ messageId, to }` with `--format json`.

  `main.ts` gains `--reason`, the `stop` command and its usage and help
  text. `stop-command.test.ts` has 4 tests:
  - a request written for a live run, with its message id printed;
  - an unknown and a gone instance refused with nothing written;
  - a missing id and a blank reason refused;
  - the JSON output.

  cli typechecks and lint is clean. `stop-command` passes 4 tests and
  `main` 23.
- [x] 3.2 `describeChangeCards` in `packages/core/src/change-card.ts` marks a
  live run that is not `ownedHere` as `stoppableByMe` only when both hold:
  - its record is verified;
  - its `person` label equals the roster label of this host's machine key,
    which the host passes as `myLabel`.

  Do not compare in the view.

  Done, in `cardRun`, and nowhere in a view.
  - `ChangeCardInputs` gains `myLabel` and `stopsAsked`, when this host
    asked each run, by instance id.
  - `ChangeCardRun` gains `stoppableByMe`, `signature`, `person`,
    `stopRequested` and `stopAskedAt`. A run this host holds is never
    `stoppableByMe`, since it is stopped as its own.
  - The survey now carries each run's `stopRequested`, an optional field
    on `SurveyedRun` that `toRun` fills from the record.
  - Hosts find `myLabel` with the new `myRosterLabel` in core. It reads the
    roster beside the status directory first, and loads no key where
    nobody is enrolled.

  Tests: `change-card.test.ts` "a run held elsewhere" covers a verified run
  of my label, of another label, one with no label given, an unverified
  run, and a run held here. `agent-messages.test.ts` has two tests for
  `myRosterLabel`.
- [x] 3.3 A card whose run is `stoppableByMe` offers `Stop`, with the same
  reason form as for an owned run. Sending it calls:
  - `POST /api/runs/ask-to-stop` in the standalone server, handled by
    `handleAskToStopRequest` in `rest.ts`;
  - `pipeline/ask-to-stop` in the editor's pipeline panel.

  Both handlers check that the instance is one of the live records they have
  just read, and refuse any other. They then call `askRunToStop` with the
  host's key.

  Done.
  - **The card.** Its `Stop`, named `Stop <change>`, opens the same reason
    form and calls the view's new `onAskToStop` with the change, the
    instance id and the reason. It is not offered again while the request
    waits to be read, or once the run has heard a stop.
  - **Standalone.** `askRunToStop` in `live-runs-client.ts` posts to
    `POST /api/runs/ask-to-stop`, handled by `handleAskToStopRequest` in
    `rest.ts`.
  - **Editor.** The view posts the message `openspec-ui/ask-to-stop`, and
    the panel answers with `openspec-ui/ask-to-stop-result`. It is a
    message rather than a request op because a request carries only its
    id and op, and a card's other controls are messages already.
  - **The check.** Both handlers call `askLiveRunToStop` in core. It reads
    the live records now, refuses any other instance and says why, and
    only then calls `askRunToStop` with the host's key, machine and git
    author.
  - `/api/live-runs` and `pipeline/live-runs` now also answer with
    `myLabel`.
- [x] 3.4 A card whose run is neither `ownedHere` nor `stoppableByMe` states
  whose the run is (`<label>'s run, verified`, or `not verified`) and offers
  no Stop.

  Done: `describeChangeCard` adds that line. Two earlier card tests pinned
  a card's whole line list for a run nobody held here, and now expect it.
- [x] 3.5 Until the run's record shows `stopRequested`, the card says
  `stop requested <age> ago; waiting for the run to read it`. After two
  renewal windows it says `the run has not read the request`.

  Done.
  - The line is `stop requested 5s ago; waiting for the run to read it`,
    since a card's age already ends in "ago". Once
    `STOP_REQUEST_READ_WITHIN_MS` has passed it becomes
    `stop requested 30s ago; the run has not read the request`. It never
    says the run refused.
  - `STOP_REQUEST_READ_WITHIN_MS` is 10 seconds, written in `change-card.ts`
    because that module is the browser's. A test pins it to twice
    `AGENT_STATUS_RENEW_INTERVAL_MS`.
  - The line goes once the run's record shows `stopRequested`.
  - The view records when it asked, and reads the runs again a second
    later.
- [x] 3.6 Tests:
  - webui `PipelineView.test.tsx`: Stop is offered only for a verified run
    whose person is `myLabel`, and the waiting words appear;
  - server: the route refuses an unknown instance;
  - extension: `pipeline/ask-to-stop` refuses an unknown instance.

  Done.
  - **webui.** "asking a run elsewhere to stop" has 3 tests: Stop offered
    and sent for my own verified run, then the waiting line and no second
    Stop; no Stop on another person's run, which says whose it is; no Stop
    on an unverified run. The file passes, 45 tests.
  - **Server.** "refuses to ask an unknown instance to stop, and a request
    with no reason". The file passes, 87 tests.
  - **Extension.** One test asks a live run and refuses an unknown instance
    and a blank reason, through the real `askLiveRunToStop` over records
    the test supplies. Another answers the live runs with `myLabel`. The
    panel's test readers now fake `myLabel` and `askLiveRun`, so no test
    reads or makes this machine's key. The file passes, 21 tests.

  Core, cli, server, extension and webui typecheck, and lint is clean.
  Core passes `change-card` 28, `agent-messages` 9 and
  `stop-request-handlers` 4.

## 4. Verification

- [x] 4.1 This change validates strictly. `check(validate-change)`

  Done: `openspec validate a-run-elsewhere-can-be-asked-to-stop --strict`
  reports the change valid, run before section 3 was committed.
- [x] 4.2 Run `npm run verify` unpiped, after the last edit, with everything
  staged. Record the run and each package's test count.

  Run on 2026-09-14 at 11:52, unpiped, with everything committed, after
  rebasing onto main at `3cd6e50` (with `a-card-opens-to-its-tasks`).
  Typecheck and lint passed. The tests:
  - cli: 161 in 16 files, all passed;
  - core: 1456 in 105 files, with 1455 passed and 1 failed;
  - extension: 375 in 28 files, all passed;
  - server: 100 in 4 files, all passed;
  - webui: 471 in 51 files, all passed.

  The core failure is not this change's. In `git-refs.test.ts`, "reads a
  directory and a file from a branch that is not checked out", Git's own
  `sh.exe` died during the test's `git push`:
  `fatal error - add_item ("\??\C:\Tools\Git", "/", ...) failed, errno 1`.
  It is the same MSYS failure under load that `a-change-is-run-from-its-card`
  7.2 recorded. The file alone passed, 3 of 3.

  Closed on CI. On PR #502 at `f56fe1a`, which also carries 4.6's edit, run
  34827785930 passed "Typecheck, lint, test, and build" with the whole
  suite in one run. "Standalone browser and accessibility", "Extension
  integration and package", "OpenSpec change validation (merge gate)",
  "Dependency audit" and "Dependency review" also passed. The release jobs
  were skipped, as on every pull request.
- [x] 4.3 A pending changeset exists: core, cli, server, extension and webui,
  each at minor. `check(changeset-present)`

  Done: `.changeset/a-run-elsewhere-can-be-asked-to-stop.md` names
  `@openspec-ui/core`, `@openspec-ui/cli`, `@openspec-ui/server`,
  `openspec-ui-vscode` (the extension) and `@openspec-ui/webui`, each minor.
- [x] 4.4 Run the whole browser suite, not a selected spec.

  Done: `npm run test:browser -w @openspec-ui/server` on 2026-09-14 at
  11:55, after rebasing onto main at `3cd6e50`. 20 of 20 passed in 6.8
  minutes, including the four `pipeline.spec.ts` specs. The screenshots it
  drew again were discarded.
- [x] 4.5 **Delegated to claude-cli**: stop a run in another worktree through
  the channel.

  Where and how:
  - Work in this working directory, on the branch
    `implement-a-run-elsewhere-can-be-asked-to-stop`. Do not touch
    `C:\Prog\OpenSpec-UI` or any other checkout.
  - Take every step in a foreground command. A command sent to the
    background ends the run with nothing recorded.
  - Port 4817 is taken by the server that started this run. Use another
    port.
  - Put the scratch repository, its worktrees and the stand-in under the
    system's temp directory. Change no tracked file except this task list.
  - B's chain must run in a host built from this branch, since only that
    reads requests. Run `openspec-ui-cli run` from this branch's source,
    for example `npx tsx packages/cli/src/main.ts run <change> --cwd <B>`.
    The built `packages/cli/dist` can predate this branch. Run the CLI's
    `status` and `stop` the same way.
  - This machine's key is the one under the home directory. Enrol it in
    the scratch repository's roster with `enrol`, and do not create or
    replace a key anywhere else.

  Setup:
  - a scratch git repository with worktrees A and B, and this machine's key
    enrolled;
  - in B, a chain with a stand-in agent that ticks a task after 20 seconds
    and then waits 60;
  - from A, the standalone server built from this branch.

  Steps:
  1. Write a request to B's run by hand, then change one byte of its
     payload.
  2. On B's run's card in A's Pipeline, press Stop with the reason
     `live check`.
  3. After B's run has ended, ask it to stop again with
     `openspec-ui-cli stop`.

  Evidence:
  - for the altered request: B's run went on, and `openspec-ui-cli status`
    reported a request that does not check out, by file name;
  - the message file for the card's request;
  - B's status record saying it was asked, by the enrolled label;
  - B's chain ending entry, with `stopRequest` and the message id;
  - the time from asking to `cancelled`, which falls after the tick;
  - the CLI command's output for the ended run: refused, with a non-zero
    exit;
  - a listing of B's working directory before and after the card's request,
    showing that A wrote nothing inside B (ADR 0026 amendment).

  Done on 2026-09-14 (UTC), by one foreground Node driver kept outside the
  repository, which exited 0 with no child process left (a process listing
  afterwards found none). `<scratch>` is `%TEMP%/openspec-ui-ask-to-stop`.

  How this branch was run:
  - `npx tsx packages/cli/src/main.ts` would not have run this branch.
    `node_modules/@openspec-ui/*` in this worktree are junctions to
    `C:/Prog/OpenSpec-UI/packages`, whose core has no `agent-messages.ts`.
  - So every CLI command and the server ran as
    `node --import tsx --import <scratch>/tools/register-alias.mjs <this worktree>/packages/cli/src/cli.ts ...`,
    and `packages/server/src/cli.ts <A> 4833` for the server. The hook
    resolves `@openspec-ui/core`, `core/browser`, `server` and `webui` to
    this worktree's `src`. `import.meta.resolve("@openspec-ui/core")` gave
    `file:///C:/Prog/.worktrees/OpenSpec-UI/stop/packages/core/src/index.ts`.
  - The client was rebuilt into the gitignored `packages/server/dist/app.js`
    with `client-build-options.mjs` plus the same mapping as an esbuild
    plugin. Its metafile held no input from the main checkout.
  - `OPENSPEC_UI_WORKTREE_ROOT` was `<scratch>/wt-root`, a stand-in
    `<scratch>/bin/claude.cmd` came first on `PATH`, and inherited
    `VSCODE_*`/`ELECTRON_*` variables were removed.
  - The page was driven in headless Chromium through Playwright.

  Setup:
  - **The repository.** `<scratch>/repo`, git identity
    `live-check@example.com`, with the changes `live-stop` (tasks 1.1 and
    1.2) and `warm-up`. Each has a `harness.json` that is `autonomous`,
    with `requireConfirmationBetweenSteps: false`, `maxStageAttempts: 1`
    and `claude-cli` on every stage. A is `<scratch>/worktrees/a` on branch
    `a`. B is `<scratch>/worktrees/b` on branch `live-stop`.
  - **Why B's branch is named after the change.** A card takes its runs
    from the change's own worktree (`changeOfWorktree`). A first attempt
    with B on branch `b` never put B's run on A's card. That attempt also
    had a stand-in that did not recognise its change, so its chain ended
    at once; it is not evidence.
  - **The stand-in.** For `live-stop` it prints `Starting task 1.1`, waits
    20 s, ticks 1.1, prints `Starting task 1.2` and waits 60 s. For
    `warm-up` it holds 12 s and exits 1.
  - **Enrolment.** It needs a live record signed by the key, so
    `run warm-up --cwd <scratch>/repo` ran first.
    - `enrol --cwd <scratch>/repo` (exit 0) listed
      `6e6cd3d5b6f3ab78b809bbb3123a92fa`,
      `repo — <scratch>/repo, on HPP-NTB63, git author live-check@example.com`.
    - `enrol 6e6cd3d5b6f3ab78b809bbb3123a92fa` (exit 0) said
      `Enrolled 6e6cd3d5b6f3ab78b809bbb3123a92fa as live-check@example.com.`
    - That is the key under the home directory, which
      `loadOrCreateMachineKey` loaded, since it existed from 2026-09-14
      00:07. No key was created.
    - The roster file `wt-root/repo/.agent-roster/6e6cd3d5b6f3ab78b809bbb3123a92fa.json`
      has the label `live-check@example.com`, machine `HPP-NTB63`, and was
      confirmed at 09:16:03.224Z. The warm-up then failed by design, with
      exit 1.
  - **A's Pipeline.** The server from A listened on port 4833. The
    Pipeline tab, with the workspace root A, drew the `live-stop` card
    `in b, on branch live-stop`.
  - **B's chain.** `run live-stop --cwd <B> --format json` started at
    09:16:26.394Z. Its record `413cbe33-bfaf-487e-853a-e402ef035624` (run
    `d24e4656-67f9-43b2-8e2b-b89f9447202e`) read as verified, person
    `live-check@example.com`. The stand-in printed `Starting task 1.1` at
    09:16:38.162Z.

  Step 1, the altered request:
  - `askRunToStop` wrote a request for `413cbe33-…` with the reason
    `altered by hand`, into a staging directory outside the channel. In
    its payload, byte 152 of 278 (the first letter of the reason) was then
    changed by hand from `a` to `A` and re-encoded. Nothing else in the
    file changed.
  - The file was moved to `wt-root/repo/.agent-messages/ed7a1d97-6757-4ae0-9bd4-ac30cb4b6c47.json`
    at 09:16:30.463Z.
  - B renewed at 09:16:33.895Z with its activity still `running apply` and
    no `stopRequested`.
  - `status --cwd <scratch>/repo` (exit 0) printed the run (`running apply`,
    `signed by live-check@example.com, verified`), then
    `a request to stop that does not check out: ed7a1d97-6757-4ae0-9bd4-ac30cb4b6c47.json`.
  - At 09:16:37.122Z B's record was not gone, its activity was
    `running apply`, and the chain was still running. The run's activity
    never mentioned the request.

  Step 2, Stop on the card:
  - Before it, the card read `Running in b on task 1.1: First task, by its
    own account … Starting task 1.1 — said 13s ago 0 of 2 tasks done in b,
    on branch live-stop … Stop Copy folder path`.
  - `Stop` (`pipeline-ask-stop-live-stop`), the reason `live check` and
    `Ask to stop` were pressed at 09:16:52.347Z.
  - At once the card read `stop requested 0s ago; waiting for the run to
    read it`, with no Stop.
  - The message file appeared at 09:16:52.625Z as
    `wt-root/repo/.agent-messages/dc85fa97-ae48-4817-aff6-029fc9fd09e0.json`:
    envelope version 2, `keyId` `6e6cd3d5b6f3ab78b809bbb3123a92fa`, and the
    payload
    `{"version":1,"messageId":"dc85fa97-ae48-4817-aff6-029fc9fd09e0","kind":"stop","to":"413cbe33-bfaf-487e-853a-e402ef035624","reason":"live check","sentAt":"2026-09-14T09:16:52.593Z","machine":"HPP-NTB63","gitAuthor":"live-check@example.com"}`.
  - **B's working directory.** It was listed recursively, with each file's
    size and modification time, just before `Ask to stop` and again once
    the message file had appeared. Both listings have 24 entries, and they
    do not differ:
    - `.git`, `.gitignore`;
    - `.openspec-ui/audit.jsonl` and `workspace.lease.json`;
    - `openspec/config.yaml`;
    - the files of both changes.

    The request went only to `wt-root/repo/.agent-messages`.
  - **B's status record** read at 09:16:55.732Z:
    `stopRequested {"reason":"live check","by":"live-check@example.com","at":"2026-09-14T09:16:55.464Z"}`,
    activity `asked to stop by live-check@example.com: live check`,
    signature verified.

  B's chain, from its JSON events:
  - `stopRequested` at 09:16:55.464Z, with `reason` `live check`, `by`
    `live-check@example.com` and `outcome` `asked`;
  - the stand-in ticked 1.1 at 09:16:58.179Z;
  - `stdout` `Starting task 1.2` at 09:16:58.181Z;
  - `cancelled` at 09:16:58.623Z. The CLI exited 1.

  From asking to `cancelled` took 6.28 s: 3.12 s for the run to read the
  request at its renewal, then until its next sound point. `cancelled` came
  0.44 s after the tick and 59.6 s before the stand-in's 60 seconds would
  have run out. `tasks.md` in B was left with 1.1 ticked and 1.2 open. The
  stand-in logged nothing after its marker, and no stand-in process was
  alive.

  The chain ending entry in B's `.openspec-ui/audit.jsonl`, with `cwd` and
  `changeDir` (B and its `live-stop` directory) omitted here:
  `{"runId":"d24e4656-67f9-43b2-8e2b-b89f9447202e","agent":"chain","outcome":"cancelled","timestamp":"2026-09-14T09:16:58.623Z","stage":"apply","stopRequest":{"reason":"live check","by":"live-check@example.com","messageId":"dc85fa97-ae48-4817-aff6-029fc9fd09e0"}}`.
  The apply stage's own entry is `cancelled` at 09:16:58.624Z.

  Step 3, after the end:
  - `stop 413cbe33-bfaf-487e-853a-e402ef035624 --reason "after the end" --cwd <scratch>/repo`
    exited 1, with nothing on stdout. Its stderr was
    `openspec-ui-cli: no live run reports itself as 413cbe33-bfaf-487e-853a-e402ef035624, so there is nothing to ask. 'openspec-ui status' lists the runs that do.`
  - The message directory held the same two files before and after.
  - `status` then printed `No runs are reporting themselves.` and
    `a request to stop that does not check out: ed7a1d97-6757-4ae0-9bd4-ac30cb4b6c47.json`.

  One thing seen that no evidence item asks for. The card did not show that
  the run had heard the stop. From 09:16:52.654Z until 09:17:01.357Z, 2.7 s
  after `cancelled`, it still read `Running in b … stop requested 4s ago;
  waiting for the run to read it`. It had not read the runs again since the
  re-read a second after asking. It never said the run refused, and never
  said `the run has not read the request`. The server was stopped at
  09:17:05.650Z, so the card's later text was not observed.
- [x] 4.6 The card reads its runs again until the window to read a request
  is past. Found by 4.5.

  The defect behind 4.5's observation:
  - After asking, the view read the runs once, a second later.
  - In the standalone shell the next survey comes 30 seconds after that.
  - So a run that read the request at its renewal 3 seconds in stayed
    `waiting for the run to read it`.
  - Past `STOP_REQUEST_READ_WITHIN_MS`, the card would have said
    `the run has not read the request` from a reading taken before the run
    read it.

  Fixed in `PipelineView.tsx`:
  - The view reads the survey and the held runs `RUN_CONTROL_REREAD_MS`
    after asking.
  - It reads them again at each `PIPELINE_CLOCK_INTERVAL_MS` until one
    reading falls after `STOP_REQUEST_READ_WITHIN_MS`.
  - After that, the survey's own interval applies.

  A new `PipelineView.test.tsx` test pins the re-reads:
  - one re-read soon after the press, more up to the window, and none past
    it before the survey's interval;
  - it fails with the fix taken out.

  The file passes, 51 tests. Webui typecheck and lint are clean.
