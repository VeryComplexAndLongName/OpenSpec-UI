Asked by the owner on 2026-10-06: the Agentic Harness setup after
Initialize OpenSpec offered no local agent.

## 1. Extension

- [x] 1.1 `local-llm-settings.ts`: the settings, the key and the proxy
  switch read in one place, at each question (design.md decision 1);
  `extension.ts` builds its runners from it. Tests in
  `local-llm-settings.test.ts`: the address, key and switch reach
  detection; what is unset is left out; a changed address counts without a
  reload; an unreadable secret storage asks without a key.
  `local-llm-settings.test.ts`: 4 passed.
- [x] 1.2 Every detection in the extension asks through it (decision 2):
  `commands.ts`, `webview/ai-panel.ts`, `repo-setup-facts.ts`; the AI
  panel's tests wait for the detection the settings now precede.
  `ai-panel.test.ts`: 43 passed.
- [x] 1.3 The Agentic Harness setup offers both local agents, marked where
  their server does not answer (decision 3). Tests in `commands.test.ts`:
  nothing found offers the two marked; a server that answers offers it
  unmarked beside the CLIs found; the instructions question still follows
  the agent questions.
  The branch that skipped the questions when nothing was found is
  gone, the list never being empty. `commands.test.ts`: 164 passed, two new
  cases and two rewritten that relied on the skip.

## 2. Documents

- [x] 2.1 `HARNESS.md`: where the setup finds the local agents.
  "The local LLM": where detection looks, and what the setup offers.
- [x] 2.2 A changeset: extension, patch.
  `.changeset/the-local-model-is-offered-where-it-is-set.md`.

## 3. Checks

- [x] 3.1 `npm run typecheck && npm run lint`, and every test project, each
  on its own where the root run would exceed a background limit.
  Typecheck clean; lint 0 errors (3 warnings in lines this change did
  not touch); seven script tests pass. Core 2124, core-git-subprocess 69,
  cli 201, webui 714, server 122, extension 508 passed.
- [x] 3.2 `openspec validate the-local-model-is-offered-where-it-is-set
  --strict`, and the merge gate with the worktree's absolute path as
  `--cwd`.
  Valid; the gate with the worktree's absolute path reports only 3.3
  open (Human-only).
- [ ] 3.3 **Human-only**: in the owner's VS Code with
  `openspec-ui.localLlm.baseUrl` set to the LAN model, run Set Up Agentic
  Harness and see `local-llm` and `local-llm-acp` offered.
