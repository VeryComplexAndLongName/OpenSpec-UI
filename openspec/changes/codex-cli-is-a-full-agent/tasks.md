From the review of the Codex integration and four trial runs of `codex exec`
(0.164.0) on 2026-10-24; ADR 0051.

## 1. Core

- [x] 1.1 `agents/codex.ts`: `--json`, `--sandbox` by command kind,
  `--model`; the stream read into text, usage and a failed turn.
- [x] 1.2 `registry.ts`: `modelFlag: "--model"` for `codex-cli`.
- [x] 1.3 `default-runners.ts`: the allowlist requires one of the two
  sandboxes, admits `--model`; refuses no sandbox, full access and the
  bypass flag.
- [x] 1.4 `harness-step-agent.ts`: `codex-cli` reports `tokens-only`.
- [x] 1.5 `OSW-AGT-222`; `docs/messages.md` regenerated.
- [x] 1.6 Tests: the invocation by command kind, model and effort; the
  trial run's own lines told as prose with usage; a line in pieces; a
  failed turn; a failed command's tail; the allowlist's refusals.
  `codex.test.ts` 9, `default-runners.test.ts` +1; with the register,
  registry and harness config, 253 pass (2026-10-24).

- [x] 1.7 Effort by model: `codex-cli` takes `low`..`max` (the levels
  every listed model takes; `ultra` not offered); the catalog is read once
  a process and a model or effort it does not have is refused before codex
  starts (`OSW-AGT-011`, `OSW-AGT-012`).
  `codex.test.ts` 12; the template tests take `copilot-cli` as the agent
  with another vocabulary; read live: 9 models, `minimal` refused for
  `gpt-6.1-sol` (2026-10-24).

## 2. Documents

- [x] 2.1 ADR 0051.
- [x] 2.2 README, HARNESS.md, LIMITS.md: what was run and measured.
- [x] 2.3 A changeset: core minor.

## 3. Checks

- [x] 3.1 `npm run typecheck && npm run lint`; the affected tests.
  2026-10-24: typecheck clean; lint 0 errors (4 warnings, none in files
  this change touched); the Codex adapter's and the allowlist's 38 tests
  pass. undici moved to 6.29.1 in the lockfile, as in
  an-acp-agent-is-heard-on-stderr, so the dependency audit passes.
- [x] 3.2 `openspec validate codex-cli-is-a-full-agent --strict`, and the
  merge gate with the worktree's absolute path as `--cwd`.
  2026-10-24: valid under `--strict`; the gate named only 3.1, 3.2 and 3.3
  as open.
- [ ] 3.3 **Human-only**: on the extension built from this branch, a change
  whose apply stage is set to `codex-cli` runs, writes its tasks' work, and
  the run reports tokens.
