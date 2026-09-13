The status record is signed with a key that belongs to a person on a
machine, read in three states, and the key is enrolled by one confirmation
(ADR 0028, ADR 0029).

## 1. A key per person, per machine

- [ ] 1.1 `packages/core/src/machine-key.ts` exports
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
- [ ] 1.2 When two calls create the key at the same time, one key results.
  The call that loses the rename reads the winner's files.
- [ ] 1.3 core `machine-key.test.ts`:
  - a key is created once and read back;
  - `keyId` stays the same across reads;
  - a signature made by `sign` verifies with `verify(null, bytes, publicKey, signature)`;
  - two concurrent first calls return the same `keyId`;
  - an unreadable private file rejects with an error the caller can catch.

## 2. The envelope

- [ ] 2.1 `packages/core/src/signed-envelope.ts` exports two functions:
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
- [ ] 2.2 core `signed-envelope.test.ts`, one test per case:
  - sealed then opened, with the key enrolled: verified;
  - the same key not enrolled: unverified;
  - one payload byte changed: does not check out;
  - a `keyId` that does not match the key: does not check out;
  - the roster holds that `keyId` with a different key: does not check out;
  - a `payload` that is not base64: does not check out.

## 3. The signed status record

- [ ] 3.1 `AgentStatusWriter` in `packages/core/src/agent-status.ts` adds
  `machine` (the host name) and `gitAuthor` (the configured git identity, or
  absent) to the version 1 document. It writes the document's bytes sealed
  by `sealEnvelope` with the machine key, loaded once per process. When no
  key can be loaded, it writes the version 1 document unsigned, and the run
  continues.
- [ ] 3.2 `readAgentStatusRecord` reads the file in one of two ways:
  - a version 2 envelope goes through `openEnvelope`, and the payload is
    parsed as the version 1 document only once the envelope opens;
  - a version 1 document is read as today, with state unverified.
- [ ] 3.3 `AgentStatusReport` gains `signature`
  (`"verified" | "unverified" | "does-not-check-out"`), and gains `person`
  when the record is verified. A record that does not check out is reported
  with its file name only, and the sweep keeps it as it keeps a malformed
  record.
- [ ] 3.4 core `agent-status.test.ts`:
  - a signed record from an enrolled key reads as verified, with its person;
  - the same record before enrolment reads as unverified;
  - a record with one byte changed does not check out, its activity is not
    reported, and the sweep keeps it;
  - a writer with no key writes version 1, and the run's events pass
    unchanged.

## 4. The roster and enrolment

- [ ] 4.1 `packages/core/src/agent-roster.ts` exports
  `agentRosterDirectory(root, mainPath)`, which returns
  `<root>/<repo>/.agent-roster`, beside `agentStatusDirectory`. Each entry
  is its own file, `<keyId>.json`, holding
  `{ keyId, publicKey, label, gitAuthor?, machine, confirmedAt }`, written
  through a temporary name and rename.
- [ ] 4.2 `readAgentRoster(directory)` returns only entries whose file name
  equals their `keyId` and whose `keyId` matches their `publicKey`. It
  reports every other file as malformed and never trusts it.
- [ ] 4.3 `collectEnrolmentRequests({ statuses, roster })` returns one request
  for each key that signed a live, unverified record and is not in the
  roster. A request carries:
  - `keyId`;
  - `label`, the working directory's name;
  - `workingDirectory`;
  - `machine`;
  - `gitAuthor`;
  - `seenAt`.
- [ ] 4.4 `confirmEnrolment({ rosterDirectory, request, label })` writes the
  roster entry for the request's key and returns it. It refuses a `keyId`
  already enrolled with a different public key.
- [ ] 4.5 core `agent-roster.test.ts`:
  - a misnamed file is not trusted;
  - a file whose key does not match its `keyId` is not trusted;
  - an unenrolled key with a live record produces one request;
  - confirming the request enrols the key;
  - a later record from that key reads as verified;
  - confirming a conflicting key is refused.

## 5. Where it shows

- [ ] 5.1 `HumanOnlyInbox` in `packages/core/src/human-only-inbox-view.ts`
  gains `enrolments?: EnrolmentRequest[]`, and `collectHumanOnlyInbox`
  fills it.
- [ ] 5.2 In the standalone inbox, each enrolment request shows its label,
  path, machine, git author and time, with one button, `It was me`. The
  button sends `POST /api/enrolment/confirm` with the `keyId`, and the
  server handles it with `confirmEnrolment`, authorized like the inbox's
  other routes. Add a route test.
- [ ] 5.3 In the editor's Human-Only Inbox tree, each request is a row with
  the same facts and an inline `It was me` action. The action runs
  `openspec-ui.confirmEnrolment` with the `keyId`. Add an extension test.
- [ ] 5.4 `openspec-ui-cli enrol` lists the requests, and
  `openspec-ui-cli enrol <keyId> [--label <text>]` confirms one. Add
  `packages/cli/src/enrol-command.ts` and its test.
- [ ] 5.5 `SurveyedRun` gains `signature` and `person`. `describeRun` adds
  one line:
  - `signed by <label>, verified` when verified;
  - `not verified` when unverified;
  - `its signature does not check out` when it does not check out.
- [ ] 5.6 `openspec-ui-cli status` prints the same line, and its JSON
  carries `signature` and `person`.

## 6. Verification

- [ ] 6.1 This change validates strictly. `check(validate-change)`
- [ ] 6.2 Run `npm run verify` unpiped, after the last edit and with
  everything staged. Record the run and the test count of each package.
- [ ] 6.3 A pending changeset exists: core, cli, server, extension and webui
  each at minor. `check(changeset-present)`
- [ ] 6.4 Run the whole browser suite, not a selected spec.
- [ ] 6.5 **Delegated to claude-cli**: sign, enrol and tamper with real runs.

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
- [ ] 6.6 **Human-only**: read one enrolment request in the standalone inbox
  and one in the editor, and say whether it lets you decide "was this me" at
  a glance.
