From the live reading of `codex-acp` 2.2.2 on 2026-10-24
(`@agentclientprotocol/codex-acp`, the successor of the deprecated
`@zed-industries/codex-acp`); ADR 0052.

## 1. Core

- [x] 1.1 `acp-session-driver.ts`: `sessionOptions` checked against the
  `configOptions` of `session/new`, then set with
  `session/set_config_option` before the prompt; a refusal fails the run
  with nothing set (`refuseSessionOption`).
  2026-10-24: `acp-session-driver.test.ts` +2 against a mocked peer
  offering codex's options.
- [x] 1.2 `acp-session-driver.ts`: cached tokens read as
  `cachedReadTokens`/`cachedWriteTokens`.
  2026-10-24: `acp-session-driver.test.ts` +1 with codex's live answer.
- [x] 1.3 `codex-acp.ts`: `mode` from `codexSandboxFor`, `model`,
  `reasoning_effort`.
  2026-10-24: `codex-acp.test.ts` 5 pass.
- [x] 1.4 `registry.ts` `takesModel`; `harness-step-agent.ts` efforts
  `low`..`max`, `reports: "tokens-only"`, `contextGauge: "sends"`.
  2026-10-24: `harness-config.test.ts` accepts a model and `max`, refuses
  `minimal`; the CLI's agents report takes `gemini-cli-acp` as the agent
  without an effort.
- [x] 1.5 `OSW-AGT-223`, `OSW-AGT-224`; `docs/messages.md` and the harness
  schemas regenerated.
  2026-10-24: core typecheck clean; 521 core tests over the agents, the
  register and the harness config pass; webui 769 pass.

## 2. Documents

- [x] 2.1 ADR 0052, and 0051 and 0052 in the ADR index.
- [x] 2.2 HARNESS.md: the effort table, the agent row, how the options are
  set; LIMITS.md: usage and the context gauge measured; README.md: the
  bridge's package, and that codex over ACP has run.
- [x] 2.3 Changeset.

## 3. Verification

- [x] 3.1 `openspec validate codex-cli-acp-is-a-full-agent --strict`.
  2026-10-24: valid.
- [x] 3.2 Live, through `openspec-ui-cli run change` from this branch: a
  scratch repository with one task, apply on `codex-cli-acp` with the
  model `gpt-6.1-sol` and the effort `low`. The agent asked one question
  (whether the repository root is within its scope), answered with
  `answer question`; it then wrote `hello.txt` (bytes `h`, `i`, LF), ticked
  1.1, reported 12,288 and 7,677 tokens over its two turns, and the chain
  went on through verify to archive. The model `gpt-x` was refused before
  the prompt: "codex-acp takes the model values gpt-6.1-sol, gpt-6-astra,
  gpt-6-sol, gpt-6-luna, gpt-5.6-sol, gpt-5.6-terra, gpt-5.6-luna, not
  \"gpt-x\"" (2026-10-24).
- [x] 3.3 **Human-only**: on the extension built from this branch, a
  change whose apply stage is set to `codex-cli-acp` runs, writes its
  tasks' work, and the run reports tokens.
  2026-10-24: run at the operator's request through `openspec-ui-cli run
  change` at d9c30cf2 (the same core chain the extension drives), not the
  extension's panel: a fresh scratch repository with one task, apply on
  `codex-cli-acp` with `gpt-6.1-sol` and the effort `medium`. Codex wrote
  `hello.txt` (bytes `h`, `i`, LF) with no question, ticked 1.1, the run
  reported 14,869 tokens, and the chain went on through verify to archive.
