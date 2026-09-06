This moves working code rather than writing new behaviour, so the risk is
not that it fails — it is that it silently changes what the gate catches.
Section 4 exists to hold that line: the same repository, checked before
and after, must produce the same verdict.

## 1. The reader in core

- [ ] 1.1 `packages/core/src/change-graph.ts`: read every
  `openspec/changes/*/.openspec.yaml` and every
  `openspec/changes/archive/*/.openspec.yaml`, resolving the archive's
  `<YYYY-MM-DD>-` prefix so an edge survives archiving.
- [ ] 1.2 Port the narrow parser as it stands, including the rule that a
  relation key not starting its own line is an error. That rule exists
  because several of these files end without a trailing newline, so an
  appended key silently glues onto the last line — the first attempt to
  prove the gate bites failed on exactly this.
- [ ] 1.3 Port the reporting of a key present in a shape the parser does
  not accept. An unreadable edge must not read as "no edge stated".
- [ ] 1.4 Export the types the extension will need, so
  `change-graph-in-vscode` adds no parsing of its own.

## 2. The blocking relation

- [ ] 2.1 `blocked_by: [<change-id>, ...]` — changes that must land
  before this one can start. Accepts the same three shapes as the other
  two keys.
- [ ] 2.2 Resolution and cycle detection cover it, on the same terms.
- [ ] 2.3 An unmet blocker — a named change still active — is **not** a
  failure. Expose it as state on the node so a renderer can report it.
- [ ] 2.4 Keep it out of the historical tree's parent edges. `follows`
  says a change grew out of another; `blocked_by` says it is waiting.
  Threading both into one tree would claim an order the repository never
  stated.
- [ ] 2.5 Document all three keys in `openspec/README.md`, replacing the
  two-key description, and say plainly which resolves and which does not.

## 3. The gate as a test

- [ ] 3.1 `packages/core/src/change-graph.test.ts`: unit tests over
  fixtures, carrying across every case the script's tests already cover —
  the three shapes, the glued key, the unreadable shape, an edge to an
  active change, to an archived one, to nothing, and a cycle.
- [ ] 3.2 One test that reads **this repository's own** `openspec/changes`
  and asserts the relations resolve with no cycle. Precedent:
  `harness-config.test.ts`'s "still loads every harness.json under
  openspec/changes" and `task-checklist.test.ts`'s "parses every real
  tasks.md without throwing".
- [ ] 3.3 That test does real filesystem work over a directory that grows
  with the repository, so it states a measured budget like every other
  such file, and the project already states a `hookTimeout`.
- [ ] 3.4 Delete `scripts/check-change-graph.mjs` and its test, and
  remove `lint:change-graph`/`test:change-graph` from the root scripts.
  One implementation, or the two drift.
- [ ] 3.5 Rewire `scripts/change-graph.mjs` to read through core. It is
  the one caller that can afford a build, because it renders rather than
  gates.

## 4. Prove the move changed nothing

- [ ] 4.1 Run the old script and the new test against this repository
  before deleting the script, and confirm both report the same thing on
  the same six backfilled edges.
- [ ] 4.2 Reintroduce, temporarily, each failure the old check caught —
  an edge to nothing, a cycle, a glued key — and confirm the new test
  fails on each, by name. A port that quietly stops catching something is
  the failure mode here.
- [ ] 4.3 Confirm the gate runs on a checkout where nothing is built:
  `npm ci && npm run test` with no build step, or the equivalent, so the
  claim in the proposal is measured rather than assumed.

## 5. Verification

- [ ] 5.1 `openspec change validate --strict change-graph-in-core`.
- [ ] 5.2 `npm run typecheck`, `npm run lint`, `npm run test` on an idle
  machine. Read the whole failing-file list, not the first familiar line.
- [ ] 5.3 Version bump via `npx changeset`: `@openspec-ui/core` gains
  exported API. Unlike `change-dependency-graph`, which touched nothing
  published, this one does.
- [ ] 5.4 Declare `blocked_by` on the three changes planned after this
  one, and confirm `npm run graph:changes` reports them as waiting.
