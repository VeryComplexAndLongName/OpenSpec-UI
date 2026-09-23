## Why

`deepseek-cli-acp` runs `dsh`, and `dsh` dies without a word on a Node
that is too old. The product already says so after the fact, but it says
the wrong thing: "needs a Node newer than 22.11", which is what was
observed rather than what is true.

The cause, found on 2026-09-23 in `@deepseek-ai/dsh` 0.1.5-rc.2, is one
line at the end of its entry point:

```js
if (import.meta.main) await runCli();
```

Node added `import.meta.main` in 24.2.0 and backported it to 22.18.0. On
anything older it is `undefined`, so `runCli()` is never called: the
process loads the module, does nothing, and exits with code 0. Nothing is
printed, not even for `--version`, and `--trace-uncaught` shows nothing,
because nothing threw.

Two things follow, and both cost a person a run:

- The floor is not "newer than 22.11". It is 22.18 on the 22 line, or
  24.2. Someone told "newer than 22.11" who installs 22.14 meets the same
  silence, and now believes the advice was wrong.
- The person learns this only after a dead run. The Node the agent will
  be started with can be asked in a few milliseconds, before anything is
  spawned.

## What Changes

- The adapter asks the Node on the PATH its version before starting
  `dsh`, and where that Node cannot run `dsh`, refuses at once with a
  reason naming the version it found, the floor, and why the floor is
  what it is.
- Where the Node cannot be read, or is new enough and `dsh` still says
  nothing, the run keeps the after-the-fact explanation, with the same
  corrected floor.
- `HARNESS.md` and `README.md` state the floor as two versions rather
  than one, and say what makes it so.
- `LIMITS.md` is corrected where the live run of 2026-09-23 contradicts
  what was measured the day before: `dsh` does send `usage_update`, and
  what it carries is how much of a 1,000,000-token context window is
  spent, not a spend.

## Capabilities

### New Capabilities

(none)

### Modified Capabilities

- `execution-core` - what a DeepSeek run does about the Node it would be
  started with.

## Impact

- `packages/core/src/agents/deepseek-acp.ts` and its tests.
- `HARNESS.md`, `README.md`, `LIMITS.md`.
- One requirement in `openspec/specs/execution-core/spec.md`.

## Explicitly out of scope

- **This repository's own pinned Node.** `volta` pins 22.11.0, which is
  below the floor, so `dsh` started from inside this repository still
  cannot run. Raising the pin is a runtime decision for the whole
  workspace and its CI, it fixes nothing for anyone else's repository,
  and the change here is what tells a person in either repository what
  is wrong.
- **The published articles** that quote "newer than 22.11". They belong
  to whoever writes them.
