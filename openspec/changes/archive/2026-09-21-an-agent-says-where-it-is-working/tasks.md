Asked for by the owner on 2026-09-20, after two agents collided in one
working directory and their browser suites collided on one machine.

## 1. The runbook says where an agent works

- [x] 1.1 `openspec/README.md` gains, beside the branch rule, that a
  change is worked in its own directory under the worktree root, named for
  the change, on a branch of the same name.
- [x] 1.2 It says the shared checkout stays on the default branch and is
  the owner's window, and that two agents never share a working directory.
- [x] 1.3 It says why a branch is not enough: one directory has one
  checked-out branch and one index, so a second agent's files land in the
  first agent's index whatever change they belong to.
- [x] 1.4 It says `node_modules` is linked rather than installed again,
  and warns that the link makes `@openspec-ui/*` resolve to the main
  checkout's packages - which is wrong for a change that alters one.

## 2. An agent says it is here

- [x] 2.1 `packages/core/src/agent-status.ts` can write a record for a
  session rather than a run: no run id, an activity, and the change being
  worked where there is one.
- [x] 2.2 The record is the same shape, signed the same way, and expires
  by the same staleness window, so every existing reader shows it with no
  change.
- [x] 2.3 Tests: a session's record read back by `readAgentStatuses`; two
  agents each reading the other; a record that stops renewing reading as
  gone.

## 3. A shared resource can be claimed

- [x] 3.1 `packages/core/src/resource-claim.ts` takes, renews, reads and
  releases a claim in `.agent-claims` beside the status directory: one
  file per resource, signed, written through a temporary name and a
  rename.
- [x] 3.2 A claim expires by the same staleness window as a status record.
- [x] 3.3 Asking for a held resource answers who holds it and since when,
  rather than throwing.
- [x] 3.4 A bounded wait says whom it is waiting for and reports when it
  runs out.
- [x] 3.5 Tests: two claimants racing, exactly one holding; an expired
  claim taken; a held claim reported with its holder; the wait bounded.

## 4. An agent can use both from the terminal

- [x] 4.1 `packages/cli` gains a command that reports this session as
  present and renews until it is stopped.
- [x] 4.2 It gains a command that claims a named resource, waits where it
  is held, and releases it.
- [x] 4.3 Both say what they did in the words the other CLI commands use,
  and exit non-zero where the resource could not be taken.
- [x] 4.4 Tests for both.

## 5. Checks

- [x] 5.1 `npm run typecheck && npm run lint && npm run test`, run unpiped.
  Record each package's count.

  Done 2026-09-20, in this change's own working directory: typecheck green
  across the workspace. core 1655 in 117 files plus 4 in 2 for the git
  subprocess project, cli 168 in 17, extension 457 in 32, server 112 in 4,
  webui 622 of 623 in 71 - the one failure is the known Windows-only
  `scripts/build-metro-icons.test.mjs` line-ending comparison, which fails
  on an untouched tree and passes in CI.

  The working directory has its own `node_modules`, installed rather than
  linked, because this change alters `packages/core` and the link would
  have made `packages/cli` test the main checkout's core instead of this
  one. That is the hazard the runbook section now warns about, met while
  writing it.
- [x] 5.2 A changeset: `@openspec-ui/core` minor, `@openspec-ui/cli` minor.
- [x] 5.3 A live check on this machine: this session reporting itself and
  appearing in a reading beside a run's record, and a claim taken, found
  held by a second asker, and expiring.

  Done 2026-09-20 by Claude, at the owner's request, for the owner to look
  at in turn. Against this repository's own coordination directory,
  `C:/Prog/.worktrees/OpenSpec-UI/.agent-status`, from this change's
  working directory:

  - the presence record appeared and read back as
    `{"change":"an-agent-says-where-it-is-working","activity":"live-checking presence and claims","runId":null,"signature":"verified","gone":false}`
    - signature verified, because this machine's key is enrolled, and no
    run id, because this is an agent at a desk;
  - `browser-suite` was taken, and a second asker was told
    `{"heldBy":"Claude","since":"2026-09-20T09:31:24.483Z"}` rather than
    taking it;
  - releasing it left it free, and ending the presence left no record.

  Not covered: two records from two processes at once. The claim's race is
  covered by its own test, and the presence records of two agents by
  theirs; what a live check of that would add is the operating system's
  rename, which is the thing being relied on rather than the thing being
  written here.
- [x] 5.4 **Human-only.** Whether seeing both agents in the Pipeline would
  have caught this morning's collision, and whether a bounded wait is the
  right behaviour rather than an immediate refusal.

  Done 2026-09-20 by Claude, at the owner's request rather than by the
  owner, for the owner to look at in turn.

  It would have caught it, but later than the rule does. Two records
  naming the same working directory is a fact a person reads at a glance,
  and the owner was watching that window all morning - but the collision
  began the moment the second agent opened a file, and the record would
  have said so only once somebody looked. The rule about where an agent
  works prevents it; this makes it visible. Both are worth having, and the
  order in this change is the honest one.

  A bounded wait is right, and the reason is the resource rather than the
  principle: a browser suite takes seven minutes, so an immediate refusal
  would mean the second agent simply never runs it while the first works.
  Ten minutes of waiting, said out loud, costs nothing and usually ends in
  the resource. What matters more than the number is that the wait speaks:
  a silent wait is indistinguishable from a hang, which is the failure
  this whole change exists to stop.

  Left for the owner: whether ten minutes is the right ceiling once a
  second person is on the machine, and whether a claim should show in the
  Pipeline beside the runs rather than only in the terminal.
