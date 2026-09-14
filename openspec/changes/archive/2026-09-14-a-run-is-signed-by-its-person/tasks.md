The status record is signed with a key that belongs to a person on a
machine, read in three states, and the key is enrolled by one confirmation
(ADR 0028, ADR 0029).

## 1. A key per person, per machine

- [x] 1.1 `packages/core/src/machine-key.ts` exports
  `loadOrCreateMachineKey({ homeDir }): Promise<MachineKey>`.
  - It reads `<homeDir>/.openspec-ui/identity/ed25519.pem` and
    `ed25519.pub.pem`.
  - If they do not exist, it generates an Ed25519 pair with
    `generateKeyPairSync("ed25519")` and writes both files through a
    temporary name and rename. The private file gets mode `0o600`.
  - `MachineKey` is `{ keyId, publicKeyPem, sign(bytes: Uint8Array): Uint8Array }`.
  - `keyId` is the first 32 hex characters of the SHA-256 of the public
    key's DER encoding.
  - It uses no passphrase: a run must be able to sign without a person
    present (ADR 0028).

  Done. `MachineKey` also carries `publicKey`, the base64 of the SPKI DER
  encoding, which is how an envelope and a roster entry carry the key.
  `keyIdOf` is exported for the envelope and the roster.
- [x] 1.2 When two calls create the key at the same time, one key results.
  The call that loses the rename reads the winner's files.

  Done. A rename replaces a name that is already taken, so the private file
  is placed with a hard link from the temporary file instead. A hard link
  fails where the name is taken. A filesystem with no hard links gets an
  exclusive create. Every call then signs with the private file on disk.
  The public file is derived from it. Windows refuses a rename onto a public
  file another call holds open; since every writer writes the same bytes,
  that refusal is taken as done once the bytes are there.
- [x] 1.3 core `machine-key.test.ts`:
  - a key is created once and read back;
  - `keyId` stays the same across reads;
  - a signature made by `sign` verifies with `verify(null, bytes, publicKey, signature)`;
  - two concurrent first calls return the same `keyId`;
  - an unreadable private file rejects with an error the caller can catch.

  Done: 5 tests. The concurrency test races three first calls.

## 2. The envelope

- [x] 2.1 `packages/core/src/signed-envelope.ts` exports two functions:
  - `sealEnvelope(bytes, key)` returns
    `{ version: 2, keyId, publicKey, signature, payload }`, where `payload`
    and `signature` are base64.
  - `openEnvelope(text, roster)` returns one of three results:
    - `{ state: "verified", bytes, person }`;
    - `{ state: "unverified", bytes }`;
    - `{ state: "does-not-check-out", why }`.

  `openEnvelope` checks that `keyId` equals the digest of `publicKey`,
  verifies `signature` over the decoded payload bytes, and only then returns
  the bytes. It never parses the payload itself.

  Done. Both opened states also carry `signer` (`keyId` and `publicKey`):
  an enrolment request needs to know which key signed an unverified record.
  Base64 is checked strictly, since Node's decoder accepts anything.
- [x] 2.2 core `signed-envelope.test.ts`, one test per case:
  - sealed then opened, with the key enrolled: verified;
  - the same key not enrolled: unverified;
  - one payload byte changed: does not check out;
  - a `keyId` that does not match the key: does not check out;
  - the roster holds that `keyId` with a different key: does not check out;
  - a `payload` that is not base64: does not check out.

  Done: 6 tests.

## 3. The signed status record

- [x] 3.1 `AgentStatusWriter` in `packages/core/src/agent-status.ts` adds
  `machine` (the host name) and `gitAuthor` (the configured git identity, or
  absent) to the version 1 document. It writes the document's bytes sealed
  by `sealEnvelope` with the machine key, loaded once per process. When no
  key can be loaded, it writes the version 1 document unsigned, and the run
  continues.

  Done. The writer seals when it is given a `key`. `startAgentStatusWriter`
  loads the key once per process, and the git author once per working
  directory, only after the status directory is found. A key that cannot be
  loaded is no key. `withAgentStatus` accepts `loadKey` and `readGitAuthor`
  seams, so a unit test never makes a key in the tester's own home.
- [x] 3.2 `readAgentStatusRecord` reads the file in one of two ways:
  - a version 2 envelope goes through `openEnvelope`, and the payload is
    parsed as the version 1 document only once the envelope opens;
  - a version 1 document is read as today, with state unverified.

  Done. The roster is read from beside the status directory unless a
  `roster` is given, by `readAgentStatuses` and by the sweep alike.
- [x] 3.3 `AgentStatusReport` gains `signature`
  (`"verified" | "unverified" | "does-not-check-out"`), and gains `person`
  when the record is verified. A record that does not check out is reported
  with its file name only, and the sweep keeps it as it keeps a malformed
  record.

  Done. The report also carries `signer`, `machine`, `gitAuthor` and, for a
  record that does not check out, `signatureProblem`, which says why and
  takes nothing from the contents. Such a report is never `gone`, so the
  sweep keeps it, and its other fields are empty.
- [x] 3.4 core `agent-status.test.ts`:
  - a signed record from an enrolled key reads as verified, with its person;
  - the same record before enrolment reads as unverified;
  - a record with one byte changed does not check out, its activity is not
    reported, and the sweep keeps it;
  - a writer with no key writes version 1, and the run's events pass
    unchanged.

  Done: 4 tests. The last loads a key that throws. The sweep test that pins
  a record's fields now lists `machine`, with the reason.

## 4. The roster and enrolment

- [x] 4.1 `packages/core/src/agent-roster.ts` exports
  `agentRosterDirectory(root, mainPath)`, which returns
  `<root>/<repo>/.agent-roster`, beside `agentStatusDirectory`. Each entry
  is its own file, `<keyId>.json`, holding
  `{ keyId, publicKey, label, gitAuthor?, machine, confirmedAt }`, written
  through a temporary name and rename.

  Done, with `rosterDirectoryBeside(statusDirectory)` for readers that
  already hold the status directory.
- [x] 4.2 `readAgentRoster(directory)` returns only entries whose file name
  equals their `keyId` and whose `keyId` matches their `publicKey`. It
  reports every other file as malformed and never trusts it.
- [x] 4.3 `collectEnrolmentRequests({ statuses, roster })` returns one request
  for each key that signed a live, unverified record and is not in the
  roster. A request carries:
  - `keyId`;
  - `label`, the working directory's name;
  - `workingDirectory`;
  - `machine`;
  - `gitAuthor`;
  - `seenAt`.

  Done. A request also carries `publicKey`, so confirming needs nothing
  else. It is built from the key's most recent record.
- [x] 4.4 `confirmEnrolment({ rosterDirectory, request, label })` writes the
  roster entry for the request's key and returns it. It refuses a `keyId`
  already enrolled with a different public key.

  Done. The label defaults to the request's git author, then to the
  directory's label (design.md). Confirming a key already enrolled with the
  same public key returns that entry unchanged, so a key is enrolled once. A
  request whose key does not match its id is refused too. Refusals are
  `EnrolmentRefusedError`. `packages/core/src/enrolment.ts` adds
  `readEnrolmentRequests(workspaceRoot)` and
  `confirmEnrolmentFor(workspaceRoot, keyId)`, the one place every host
  asks. The second refuses a key id no live run is signing.
- [x] 4.5 core `agent-roster.test.ts`:
  - a misnamed file is not trusted;
  - a file whose key does not match its `keyId` is not trusted;
  - an unenrolled key with a live record produces one request;
  - confirming the request enrols the key;
  - a later record from that key reads as verified;
  - confirming a conflicting key is refused.

  Done: 5 tests, with confirming and the later verified record in one.
  `enrolment.test.ts` adds 2 tests for the workspace-level reading and
  confirmation.

## 5. Where it shows

- [x] 5.1 `HumanOnlyInbox` in `packages/core/src/human-only-inbox-view.ts`
  gains `enrolments?: EnrolmentRequest[]`, and `collectHumanOnlyInbox`
  fills it.

  Done, best-effort: a workspace that is not a git repository has nobody
  waiting to be enrolled, and its items still answer. The inbox's sentence
  says how many keys wait. `EnrolmentRequest` and its wording live in the
  browser-safe `signature-facts.ts`.
- [x] 5.2 In the standalone inbox, each enrolment request shows its label,
  path, machine, git author and time, with one button, `It was me`. The
  button sends `POST /api/enrolment/confirm` with the `keyId`, and the
  server handles it with `confirmEnrolment`, authorized like the inbox's
  other routes. Add a route test.

  Done. The requests are drawn by `components/EnrolmentRequests.tsx`, which
  has 3 tests. The route calls `confirmEnrolmentFor`, answers a refusal as
  409 with the reason, and rejects a key id that is not 32 hex characters
  before asking core. `server.test.ts` adds 3 tests.
- [x] 5.3 In the editor's Human-Only Inbox tree, each request is a row with
  the same facts and an inline `It was me` action. The action runs
  `openspec-ui.confirmEnrolment` with the `keyId`. Add an extension test.

  Done. A row reads `Was this run yours? <label>` with the request's facts
  as its description. Its inline action, "OpenSpec UI: It Was Me", asks for
  the name, defaulting to the git author. `human-only-inbox-tree.test.ts`
  adds 2 tests.
- [x] 5.4 `openspec-ui-cli enrol` lists the requests, and
  `openspec-ui-cli enrol <keyId> [--label <text>]` confirms one. Add
  `packages/cli/src/enrol-command.ts` and its test.

  Done: 5 tests. Listing exits 0; confirming exits 0, 1 when refused, and 2
  when nothing could be read or written.
- [x] 5.5 `SurveyedRun` gains `signature` and `person`. `describeRun` adds
  one line:
  - `signed by <label>, verified` when verified;
  - `not verified` when unverified;
  - `its signature does not check out` when it does not check out.

  Done. `describeRun` says a run in one sentence, so the signature is its
  last clause (`...; signed by Ada, verified`) rather than a separate line.
  A run whose record does not check out is described as
  `<file name>: its signature does not check out`, with nothing else. It is
  attached to no directory, since the directory it names cannot be trusted.
  `worktree-survey.test.ts` adds 2 tests and states the clause in the 4
  existing ones.
- [x] 5.6 `openspec-ui-cli status` prints the same line, and its JSON
  carries `signature` and `person`.

  Done: its own line beneath each run. A record that does not check out
  prints its name and that line only. 4 tests.

## 6. Verification

- [x] 6.1 This change validates strictly. `check(validate-change)`

  Done: `openspec validate a-run-is-signed-by-its-person --strict` reports
  it valid, 2026-09-14.
- [x] 6.2 Run `npm run verify` unpiped, after the last edit and with
  everything staged. Record the run and the test count of each package.

  Closed on CI 2026-09-14: the "Typecheck, lint, test, and build" job of
  #488 ran `npm run verify` against the committed tree and passed,
  <https://github.com/VeryComplexAndLongName/OpenSpec-UI/actions/runs/34796896258/job/103831637332>.
  Tests: cli 152, core 1322, extension 353, server 89, webui 437, all
  passed. Core counts one more than the local run because the test that
  failed locally, which reads the real `openspec/agent-harness.json`,
  passed against the committed file.

  Local run 2026-09-14, exit code 1. Typecheck and every lint passed.
  Tests: cli 152 passed; core 1321 passed, 1 failed; extension 353 passed;
  server 89 passed; webui 437 passed. The one failure is
  `keeps accepting this repository's real openspec/agent-harness.json`,
  which reads the working tree's file: an uncommitted local edit, not part
  of this change, sets its `autonomyLevel` to `semi-autonomous`. To be
  closed on CI's run of the same checks against the committed tree.
- [x] 6.3 A pending changeset exists: core, cli, server, extension and webui
  each at minor. `check(changeset-present)`

  Done: `.changeset/a-run-is-signed-by-its-person.md`.
- [x] 6.4 Run the whole browser suite, not a selected spec.

  Done 2026-09-14: `npm run test:browser` in `packages/server`, 18 passed
  (4.2 min). The retaken `docs/images/standalone/pipeline.png` shows the
  fixture's unsigned run as `…said 2s ago; not verified`. The pictures it
  retook of screens this change does not touch were left as they were.
- [x] 6.5 **Delegated to claude-cli**: sign, enrol and tamper with real runs.

  Setup: a scratch git repository with two worktrees, and a CLI built from
  this branch (`npm run build -w @openspec-ui/cli`).

  Steps:
  1. Start one run in each worktree with a waiting stand-in agent.
  2. Read `openspec-ui-cli status`.
  3. Run `openspec-ui-cli enrol`, then confirm the request.
  4. Read `openspec-ui-cli status` again.
  5. Change one byte of one record's payload by hand, and read
     `openspec-ui-cli status` a third time.

  Evidence: all three `status` outputs, showing not verified, then signed
  by the label and verified, then a signature that does not check out; the
  `enrol` listing; and the roster file.

  Take steps 1 to 5 in one foreground command: start both runs as child
  processes, take the readings while they wait, and return only once both
  have ended. Nothing may be left running in the background when a command
  returns, since a command left in the background ends this turn with the
  item open. A stand-in that waits long enough for step 5 is part of the
  setup; the scratch repository and the key are outside this one, with
  `HOME` and `USERPROFILE` pointed at a scratch directory so no real key is
  made.

  Done 2026-09-14 (UTC), claude-cli, Node 22.11.0 (Volta pin), Windows 10.
  `npm run build -w @openspec-ui/cli` exited 0 (`dist/cli.js 3.2mb`). One
  foreground Node driver ran every step and exited 0 once both runs had
  ended. Paths below are shortened to `<scratch>`, a directory in the
  session's temp folder, outside this repository.
  - Setup: `<scratch>/repo` is a git repository whose local git identity is
    `ada@example.invalid`. Its changes are `alpha-change` and
    `beta-change`, each with a `harness.json` that puts every stage on
    `claude-cli`, `autonomous`, no checkpoints, `maxStageAttempts: 1`.
    `git worktree add` made `<scratch>/worktrees/alpha` and
    `<scratch>/worktrees/beta`. `HOME` and `USERPROFILE` were
    `<scratch>/home`, where no identity directory existed before the runs.
    `OPENSPEC_UI_WORKTREE_ROOT` was `<scratch>/wt-root`. A stand-in
    `<scratch>/bin/claude.cmd` was first on `PATH` (`where claude` resolved
    to it). It prints `stand-in claude: holding the stage for 90 seconds`,
    waits 90 s and exits 1.
  - Step 1, 01:59:25.9Z: `node packages/cli/dist/cli.js run alpha-change
    --cwd <scratch>/worktrees/alpha` and the same for `beta-change` in
    `beta`, as child processes. Within 5 s the status directory
    `<scratch>/wt-root/repo/.agent-status` held two records, and
    `<scratch>/home/.openspec-ui/identity` held `ed25519.pem` and
    `ed25519.pub.pem`. Both runs signed with the one key
    `cdcff18a36c1aaf61ddaef6540bedabe`: `signer` in the JSON of both
    reports.
  - Step 2, `status --cwd <scratch>/repo` at 01:59:30.966Z, exit 0:
    `06ef9e0a-… on "beta-change"` / `in <scratch>/worktrees/beta` /
    `starting "beta-change"` / `said this 5s ago, last heard from 5s ago` /
    `not verified`, and the same for `e533c8de-… on "alpha-change"` in
    `alpha`, also `not verified`. The JSON gives `"signature":"unverified"`,
    `machine` `HPP-NTB63` and `gitAuthor` `ada@example.invalid` for both.
  - Step 3, `enrol --cwd <scratch>/repo` at 01:59:33.916Z, exit 0: one
    request, `cdcff18a36c1aaf61ddaef6540bedabe` /
    `beta — <scratch>/worktrees/beta, on HPP-NTB63, git author
    ada@example.invalid, last seen 2026-09-14T01:59:34.662Z`, then
    `If a run was yours, confirm its key: openspec-ui-cli enrol <keyId>
    [--label <text>]`. There was one request for the two runs, because they
    share one key. It is built from the key's most recent record.
    `enrol cdcff18a36c1aaf61ddaef6540bedabe --cwd <scratch>/repo` at
    01:59:36.537Z, exit 0: `Enrolled cdcff18a36c1aaf61ddaef6540bedabe as
    ada@example.invalid. Its runs now read as signed by
    ada@example.invalid, verified.` The listing then read `No key is
    waiting to be enrolled.`
  - The roster file, `<scratch>/wt-root/repo/.agent-roster/cdcff18a36c1aaf61ddaef6540bedabe.json`,
    the only file there: `{"keyId":"cdcff18a36c1aaf61ddaef6540bedabe",
    "publicKey":"MCowBQYDK2VwAyEAOMNjOoEuC998ZF8m3+dubwKlAoYM/bvDE7lRD89kR00=",
    "label":"ada@example.invalid","gitAuthor":"ada@example.invalid",
    "machine":"HPP-NTB63","confirmedAt":"2026-09-14T01:59:37.933Z"}`.
  - Step 4, `status --cwd <scratch>/repo` at 01:59:39.220Z, exit 0: both
    runs `(apply)`, `running apply`, and
    `signed by ada@example.invalid, verified`. The JSON gives
    `"signature":"verified"` and `person`
    `{keyId: cdcff18a…, label: ada@example.invalid, gitAuthor: ada@example.invalid}`
    for both.
  - Step 5: just after a heartbeat, one byte of the payload of
    `e533c8de-fc5c-469d-b0a0-c1a6e24f67b9.json` (the `alpha-change` run,
    envelope version 2) was changed by hand at 01:59:42.971Z. Byte 89 of
    609 is the first byte of the activity value, and it went from `s` to
    `S`. The payload was decoded, changed and re-encoded, and nothing else
    in the file was touched. `status --cwd <scratch>/repo` at once, exit 0:
    `06ef9e0a-… on "beta-change" (apply)` / … /
    `signed by ada@example.invalid, verified`, then
    `e533c8de-fc5c-469d-b0a0-c1a6e24f67b9` /
    `its signature does not check out`, with no directory, activity or
    time. Its JSON has an empty `workingDirectory` and `activity`, a null
    `machine` and `gitAuthor`, `"signature":"does-not-check-out"`, and
    `signatureProblem` `its signature does not verify over its payload`.
    The edited file was still on disk after both readings, so the status
    command's sweep kept it. The run's next heartbeat rewrote it.
  - Both runs ended by themselves (`▶ apply — claude-cli`, the stand-in's
    line, `✗ claude exited with code 1`, exit 1): alpha at 02:01:10.998Z,
    beta at 02:01:12.095Z. The status directory was then empty, and
    `status` read `No runs are reporting themselves.` Nothing was left
    running.
- [x] 6.6 **Delegated to claude-cli**: read one enrolment request in the
  standalone inbox and one in the editor, and say whether it lets a person
  decide "was this me" at a glance.

  This was a human-only item. On 2026-09-14 the owner delegated human-only
  checks to claude-cli.

  Setup: the scratch repository and stand-in of 6.5, with one live run
  signed by a key that is not enrolled, and the standalone server built
  from this branch.

  Steps:
  1. Open the standalone shell with Playwright, load the summary, and save
     a picture of the "Waiting on somebody" block showing the request. Look
     at the picture.
  2. Print the editor's Human-Only Inbox row for the same request: its
     label, description, tooltip and inline action, from
     `HumanOnlyInboxTreeProvider` against the scratch repository.

  Evidence: the picture's path and what it shows, the printed row, and a
  judgement in a sentence or two naming anything a person could not decide
  from.

  Take every step in foreground commands, as in 6.5.

  Done 2026-09-14 (UTC), claude-cli, Node 22.11.0 (Volta pin), Windows 10,
  on main at `604e575` (#488, this change merged). From Git Bash,
  `npm run build -w @openspec-ui/cli` (`dist/cli.js 3.2mb`) and
  `npm run build -w @openspec-ui/server` (`dist/app.js 1.8mb`) both exited
  0. One foreground driver, `node --import tsx --import <register-vscode>
  driver.mts`, ran every step and exited 0 once the run had ended. The
  driver's first attempt took the picture but could not load the tree
  module, because the extension package loads as CommonJS and the `vscode`
  stub was hooked for ESM only. It was rerun whole with the stub hooked for
  both, and everything below is from that rerun. `<scratch>` is a directory
  in the session's temp folder, outside this repository.
  - Setup, as in 6.5 but with one run: `<scratch>/repo` (git author
    `ada@example.invalid`), change `alpha-change` with a `harness.json`
    putting every stage on `claude-cli`, `autonomous`, no checkpoints,
    `maxStageAttempts: 1`, and worktree `<scratch>/worktrees/alpha`.
    `HOME`/`USERPROFILE` were `<scratch>/home`, `OPENSPEC_UI_WORKTREE_ROOT`
    was `<scratch>/wt-root`, and a stand-in `<scratch>/bin/claude.cmd` came
    first on `PATH`. It holds the stage for 75 s and exits 1.
    `node packages/cli/dist/cli.js run alpha-change --cwd
    <scratch>/worktrees/alpha` started at 02:22:37.733Z. By 02:22:38.568Z it
    had written one record (`36b72f8a-….json`) and created the key
    `ab8939b675639326fa5b9c1f6ba54ada`. No `.agent-roster` directory
    existed.
  - Step 1: the driver called `createServer({ workspaceRoot: <scratch>/repo
    })` from `packages/server/src/server.ts`, which serves the bundle just
    built. Playwright's Chromium (1280×900) then opened the shell with its
    token, filled the workspace root and opened the "OpenSpec view summary"
    tab. It waited for `enrolment-requests` and pictured the
    `human-only-inbox` block at 02:22:44.907Z:
    [`evidence/enrolment-request-standalone.png`](evidence/enrolment-request-standalone.png).
    The picture shows the heading "Waiting on somebody" and the sentence
    `Nothing is waiting — 1 active change read. 1 key that signs a run waits
    to be enrolled.` Below it is `Runs signed by a key nobody has enrolled.
    If a run was yours, say so, and its records read as signed by you from
    then on.` Then comes one bullet: **alpha** — `<scratch>\worktrees\alpha`
    (the full path wraps over two lines), `on HPP-NTB63, git author
    ada@example.invalid, last seen 14.09.2026, 05:22:43`, with one button,
    `It was me`. It is the only button in the requests.
  - Step 2: `new HumanOnlyInboxTreeProvider(<scratch>/repo).getChildren()`
    from `packages/extension/src/tree/human-only-inbox-tree.ts`, with
    `vscode` stubbed to the few classes the module uses and core unmocked,
    returned one row, an `EnrolmentRequestTreeItem`:
    - label `Was this run yours? alpha`;
    - description `alpha — <scratch>\worktrees\alpha, on HPP-NTB63, git
      author ada@example.invalid, last seen 2026-09-14T02:22:48.388Z`;
    - tooltip: the same text, then a new line and
      `Key ab8939b675639326fa5b9c1f6ba54ada`;
    - contextValue `openspec-ui.enrolmentRequest`, icon `key`;
    - inline action, from `package.json`'s `view/item/context` for that
      context: `openspec-ui.confirmEnrolment` "OpenSpec UI: It Was Me",
      `$(pass)`.
  - The run ended by itself at 02:23:59.561Z (`▶ apply — claude-cli`, the
    stand-in's line, `✗ claude exited with code 1`, exit 1). The status
    directory was then empty, and nothing was left running.
  - Judgement: mostly yes. Both hosts give the directory, the machine, the
    git author and a time, and one action says "it was me", with no
    fingerprint to compare. A person could not decide from four things:
    - Neither host names the change the run was working on, or what it was
      doing. The only name is the worktree directory's (`alpha`), and that
      is what a person remembers starting.
    - The shell's sentence opens `Nothing is waiting` directly above a
      request that is waiting on the reader.
    - The editor's time is raw UTC ISO (`02:22:48Z`), and the shell's is
      local time with no zone (`05:22:43`). Neither says how long ago, so
      the two hosts show the same moment as different clock times.
    - The long path leads the description, so in a narrow sidebar the
      machine, author and time are likely cut off, and are whole only in
      the tooltip. The label also repeats `alpha` at the start of the
      description.
