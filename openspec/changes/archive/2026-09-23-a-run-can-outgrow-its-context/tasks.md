Asked by the owner on 2026-09-23: introduce `maxContextShare` where it
can be introduced, after the answer to "how do we limit DeepSeek?" turned
out to be "by time, and by nothing else".

## 1. The gauge

- [x] 1.1 One reading of ACP's `usage_update`, beside the protocol, as
  every other reading of that payload here is. A window of zero reads as
  no gauge rather than as a full one.
- [x] 1.2 The reason a person reads back: the ceiling, its value, and the
  figures it was judged on, grouped the same way on every machine.

## 2. The ceiling

- [x] 2.1 `budget.maxContextShare`, a share above 0 and at most 1, in the
  type, the validator and the JSON schema; anything else refused where
  the configuration resolves.
- [x] 2.2 The chain stops the stage that is running when a reading passes
  it, as cancelled rather than failed, with the reason attached.
- [x] 2.3 The schemas the editor serves, regenerated.

## 3. What it can act on

- [x] 3.1 `contextGauge` beside `reports`: a different question, answered
  from evidence. `"none"` only where it is certain, `"sends"` for
  `deepseek-cli-acp` from the measurement of 2026-09-23, `"unknown"`
  otherwise.
- [x] 3.2 The configuration says this ceiling cannot act where the
  stage's agent speaks no ACP, and says nothing where nobody has watched.
- [x] 3.3 A stage this ceiling binds is no longer called unbounded.
- [x] 3.4 `deepseek-cli-acp`'s comment corrected: it claimed no
  `usage_update` arrives.

## 4. Documentation

- [x] 4.1 `LIMITS.md`: a fourth level, what it is and is not, and which
  agents send the gauge.
- [x] 4.2 `HARNESS.md`: the field beside the other `budget` fields.

## 5. Checks

- [x] 5.1 Live, 2026-09-23: a chain whose apply stage runs
  `deepseek-cli-acp` under `maxContextShare` set absurdly low, through the
  product's own chain runner and allowlist. On this repository's pinned
  Node the run was refused before dsh started, naming the version; under
  Node 24.18 dsh ran, its first reading was read, and the stage was
  cancelled while it was still going: "stopped at the context ceiling:
  budget.maxContextShare is 0.0%, and the agent reported 8,277 of
  1,000,000 tokens in its context (0.8%)". Cancelled, never failed.
- [x] 5.2 `npm run typecheck && npm run lint && npm run test` at the root,
  after `git add`, run unpiped, exit code 0: cli 192, core 1876 and 53,
  extension 493, server 116, webui 655.
- [x] 5.3 The extension's integration suite: 19 passing. The whole
  standalone browser suite: 29 of 29 in 9.0 minutes.
- [x] 5.4 `openspec validate a-run-can-outgrow-its-context --strict`: valid.
  The merge gate locally with `--base origin/main`: ok.
- [x] 5.5 A changeset: core and the extension, minor.
