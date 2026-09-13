# A done task is ticked

## Why

A chain archives a change only when every task in its `tasks.md` is
ticked. The archive step refuses anything less, and rightly: an agent
exiting `0` is not evidence that the work was done.

But nothing in the product asks anybody to tick.

- The implementing stage is told: *"Implement the tasks from tasks.md for
  the change described below."* Nothing about ticking.
- The verifying stage is told to *"uncheck any task in tasks.md whose
  stated verification does not actually hold."* It is told how to take a
  tick away, and never to give one.

In this repository it works anyway, by an accident of configuration.
`openspec/config.yaml` carries the rule *"The implementing agent marks each
task `[x]` in tasks.md as soon as that task's own verification has
passed"*, and the apply prompt carries the project's `tasks` rules. A
repository made with `openspec init` has no such rule.

What that looks like was seen on 2026-09-13, while verifying
`an-agent-says-what-it-is-doing`: two real `claude-cli-acp` chains in a
fresh repository. Both apply stages did every task — the files were there
with the right content — and ticked nothing. One verify stage ticked the
two tasks that left a file and would not tick the two that were commands;
the other ticked nothing. Both chains stopped at archive: *"cannot archive
"change-a": 2 task(s) still unchecked"*.

Where the rule does exist, an agent can still end without following it.
The Harness's apply stage for `an-agent-says-what-it-is-doing`, on
2026-09-12, wrote the code, started its tests in the background, and
ended its session with nothing ticked. Nothing on the chain's timeline
said a stage had done work and ticked nothing; it surfaced in a verify
report afterwards.

## What Changes

- The implementing stage is told, by the product, to tick each task as
  soon as that task's own verification has passed — as it goes, never
  before the task is done — and to leave a task it could not do unticked
  and say why. A project's rules may say more; they no longer have to say
  this.
- The verifying stage may tick as well as untick: it ticks an unticked
  task whose verification it has confirmed itself, and unticks one that
  does not hold. A task whose effect is not a file — a command that must
  pass, a condition that must hold — is confirmed by checking that effect,
  for instance by running the command; leaving no changed file is not by
  itself a reason to leave it unticked. It never ticks a task marked
  `**Human-only**` or `**Delegated to …**`.
- When an implementing run changed files and ticked no task, the chain
  says so as that stage ends. Reported, not refused: verification is the
  stage that judges, and it may tick what apply left.
- The archive refusal names the unticked tasks, as the return from
  verification already does, instead of only counting them.

## Impact

- `packages/core` — `agents/shared.ts`'s instructions for `implement` and
  `verify`; `harness-chain-runner.ts` reports an apply run that ticked
  nothing and names the tasks in the archive refusal.
- `HARNESS.md` — the stage table says which stages tick.
- No change to the archive gate itself, to mechanical checks, to
  delegated items, or to any project's rules.
