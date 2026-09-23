Asked by the owner on 2026-09-23: take on dsh. The adapter was already
written on 2026-09-22; what was left is the Node it needs, which the
product named by observation rather than by cause.

## 1. The floor

- [x] 1.1 The exact floor, with its cause, stated where the adapter lives:
  `import.meta.main`, added in Node 24.2.0 and 22.18.0.
- [x] 1.2 A reading of a Node version that answers yes, no, or "cannot
  tell", minor-aware, and unit-tested at every boundary.

## 2. The run

- [x] 2.1 The adapter asks the Node on the PATH before spawning, and
  refuses a run it knows will say nothing, naming the version found.
- [x] 2.2 A Node that cannot be read does not stop a run: the
  after-the-fact explanation still covers it, with the corrected floor.
- [x] 2.3 Tests: refused before spawning, allowed on a new enough Node,
  allowed when the version cannot be read, and the silent-exit
  explanation.

## 3. Documentation

- [x] 3.1 `HARNESS.md`: the floor as two versions and what makes it so,
  in both places that name it, and the one line in `README.md`'s agent
  table that repeated the old wording.
- [x] 3.2 `LIMITS.md`: the live run of 2026-09-23 contradicts what was
  measured on 2026-09-22. `dsh` does send `usage_update`, and what it
  carries is the tokens now in the session's context against a
  1,000,000-token window - one growing number, no split, no currency -
  while the prompt's answer carries only `stopReason`. Asked by the owner
  on 2026-09-23; `dsh-acp`'s own `usageUpdate` builds it from a context
  meter, so there is nothing further to read.

## 4. Checks

- [x] 4.1 Live, 2026-09-23: `dsh --version` says nothing and exits 0 on
  22.11.0, and prints `0.1.5-rc.2` on 24.18.0. Through the adapter itself:
  on 22.11.0 the run is refused in 40 ms, naming the version; on 24.18.0
  the same run reached DeepSeek, read the workspace, and stopped at the
  first step to say why it could not be done - which is what the literal
  preamble asks for - in 24 s over 18 updates. A second run, given a
  `tasks.md`, wrote `hello.txt` and ticked the task.
- [x] 4.2 `npm run typecheck && npm run lint && npm run test` at the root,
  after `git add`, run unpiped, exit code 0: cli 192, core 1851 and 53,
  extension 493, server 116, webui 655.
- [x] 4.3 `openspec validate dsh-names-the-node-it-needs --strict`: valid.
  The merge gate locally with `--base origin/main`: ok.
- [x] 4.4 A changeset: core, minor.
