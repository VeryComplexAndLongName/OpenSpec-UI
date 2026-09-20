Asked for by the owner on 2026-09-19, as the second half of
`a-run-is-told-where-to-stop`: the operator should be able to say something
to a run, and to see what comes back.

## 1. The channel carries more than a stop

- [x] 1.1 `packages/core/src/agent-messages.ts` carries `note`, `ask` and
  `answer` beside `stop`: one sealed message shape with a `kind`, an
  `author` of `person` or `run`, a `to` that names a run or a person, and
  the words.
- [x] 1.2 `note`, `ask` and `answer` stay fresh for a day
  (`CONVERSATION_STALE_AFTER_MS`), while `stop` keeps its minute. The
  reason each has the window it has is written where the constant is.
- [x] 1.3 Reading generalises `readStopRequests` without changing what a
  stop request does: a run reads what is addressed to it, and refuses
  `unverified`, `stale` and `seen` as before.
- [x] 1.4 A delivered or answered message is removed from the directory,
  and a sweep removes what is older than the day.
- [x] 1.5 `packages/core/src/agent-messages.test.ts` covers each kind
  written and read back, the freshness windows, a message addressed to
  another run, one whose envelope does not check out, and the removal.

## 2. A run takes them, delivers them and answers

- [x] 2.1 `packages/core/src/agent-status.ts` hands messages that are not
  stops to a new handler, once each, beside the stop handling it already
  does.
- [x] 2.2 `packages/core/src/harness-chain-runner.ts` holds what it has
  taken and adds it to the next stage's `promptContext`, saying who said it
  and when, and marking it as words from a person.
- [x] 2.3 An `ask` makes the run write an `answer` when that stage ends,
  carrying what the agent said, the stage and the run id.
- [x] 2.4 A message whose author is a run is refused unless
  `allowAgentMessages` is set in the harness configuration, and the refusal
  is recorded with its message id.
- [x] 2.5 Every taken message is recorded in the audit: who said it, what
  kind it was, and whether it was delivered.
- [x] 2.6 Tests cover: a note reaching the next stage's prompt; an ask
  answered when the stage ends; a run-authored message refused by default
  and taken when allowed; and a run that ends before another stage starts
  recording the note as undelivered.

## 3. The editor can speak and shows what comes back

- [x] 3.1 A command on a change's row sends a note or a question to the
  run recorded against it, asking for the words and which of the two it is.
- [x] 3.2 It says plainly when the change has no live run, and writes
  nothing.
- [x] 3.3 An answer addressed to this person is told to them, naming the
  stage and the run whose words it carries, and read once.

  Narrowed while doing it, and the spec says so: the answer is **not**
  listed in the Human-Only Inbox. That inbox is one reading in core over a
  change's human-only items and the keys awaiting enrolment; an answer is
  neither, and a second source for it is a change of its own. What the
  owner asked for - that an answer reaches them - is done by
  `answers-watcher.ts`, which reads the person's own side of the channel
  every ten seconds and tells them.
- [x] 3.4 Tests cover the three above.

## 4. Checks

- [x] 4.1 `HARNESS.md` documents `allowAgentMessages`, its default and what
  it lets in.
- [x] 4.2 `npm run typecheck && npm run lint && npm run test`, run unpiped.
  Record each package's count.

  Done 2026-09-20: typecheck green across the workspace. core 1621 in 114
  files plus 4 in 2 for the git subprocess project, cli 165 in 16,
  extension 454 in 32, server 109 in 4, webui 616 of 617 in 71 - the one
  failure is the known Windows-only
  `scripts/build-metro-icons.test.mjs` line-ending comparison, which fails
  here on an untouched tree and passes in CI.

  Two failures found and fixed on the way, both real: the harness settings
  views round-trip every accepted key, and their fixtures did not carry
  `allowAgentMessages`, so the new key would have been dropped on save.
- [x] 4.3 A changeset: `@openspec-ui/core` minor, `openspec-ui-vscode`
  minor.
- [x] 4.4 A live check on this machine: a note left for a real run, read at
  a renewal, carried into the next stage's prompt, and an ask answered.
  Record what was written and what came back.

  Done 2026-09-20 by Claude, at the owner's request, for the owner to look
  at in turn - the channel end of it, with this machine's real Ed25519 key
  `6e6cd3d5b6f3ab78b809bbb3123a92fa` enrolled in a temporary roster, a real
  `AgentStatusWriter`, and three real sealed messages:

  - the note and the question were taken at one renewal, each naming the
    enrolled person the roster labels, and both were removed from the
    directory;
  - the run-authored note was refused with `author-not-allowed` and left
    where it was;
  - a second renewal took nothing twice.

  Not covered, and left open as 4.5 says: the agent end. Carrying a note
  into a stage's prompt and answering a question with what that stage said
  are covered by the chain runner's own tests, over a scripted runner. A
  real agent would cost a real run, and the owner decides when to spend
  one.
- [ ] 4.5 **Open.** The agent end of 4.4, and the live check of
  `stop --after` on a real run that `a-run-is-told-where-to-stop` left
  open: both need one real chain run with a real agent, and both can be
  done in the same one. To be run against a throwaway workspace, not this
  repository, so nothing an agent does can reach the work.
- [ ] 4.6 **Human-only.** Whether leaving a note reads as intervening
  without interrupting, and whether the answer arrives where it is looked
  for.
