Asked by the owner on 2026-09-25: a local LLM at a LAN address, with a
model name and an API key.

## 1. Where it is, in core

- [x] 1.1 `resolveLocalLlmSettings`: the host's value, else the environment,
  else the old default; an empty value is none.
- [x] 1.2 `chatCompletionsUrl`: a base with its `/v1` or without.
- [x] 1.3 The adapter and the availability check send the key as a bearer
  token, and nowhere else.
- [x] 1.4 `buildDefaultAgentRunners` takes the key beside the address and
  the model, and resolves all three.

## 2. The editor

- [x] 2.1 Settings `openspec-ui.localLlm.baseUrl` and
  `openspec-ui.localLlm.model`.
- [x] 2.2 **Set Local LLM API Key...**: the editor's secret storage, removed
  by an empty value; it offers to reload the window.
- [x] 2.3 HARNESS.md: where each is set, and what the agent cannot do.

## 3. Checks

- [x] 3.1 Tests: the order of host, environment and default, and an empty
  value; the URL from a base with and without `/v1` and a trailing slash;
  the headers with and without a key; the adapter's request to a `/v1`
  base with its bearer key, and none without.
- [x] 3.2 Live against the owner's server on 2026-09-25, the real adapter
  told through the environment: the request went to
  `http://192.168.137.33:8000/v1/chat/completions`, and
  `Qwen3.6-35B-A3B-AWQ` answered "ready"; without the key the server
  answered HTTP 401. The key was given to that process alone and written
  nowhere.
- [x] 3.3 In the editor: the settings and the command, the key saved and
  the window reloaded. 2026-09-25, the Extension Development Host built
  from this worktree, with a dummy key (a real one would have stayed in the
  test profile's secret storage): the palette listed "OpenSpec Workbench:
  Set Local LLM API Key...", its box was a password box, saving said "the
  local LLM API key was saved. Reload the window for runs to use it." with
  its Reload Window button, and the Settings editor showed Base Url and
  Model under openspec-ui.localLlm. The test profile was deleted after.
- [x] 3.4 `npm run typecheck && npm run lint && npm run test` at the root,
  after `git add`, run unpiped, exit code 0. Typecheck 0, lint 0, test 0
  (core 1924, server 496, extension 116, webui 673).
- [x] 3.5 The extension's integration suite, and the whole standalone
  browser suite. Integration: 19 passing. Browser: 29 of 29; no screen
  changes, and its regenerated pictures were left out.
- [x] 3.6 `openspec validate the-local-llm-is-where-you-say --strict`, and
  the merge gate locally with `--base origin/main`. Validate: valid; the gate
  exit 0.
- [x] 3.7 A changeset: core and the extension, minor.
