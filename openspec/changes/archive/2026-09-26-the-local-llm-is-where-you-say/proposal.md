## Why

Asked by the owner on 2026-09-25: run the local LLM at
`http://192.168.137.33:8000/v1`, model `Qwen3.6-35B-A3B-AWQ`, whose server
wants an API key. "Where do I set the key?"

Nowhere. The `local-llm` adapter's address and model were fixed in
`default-runners.ts` - `http://localhost:30000` and `default` - and no host
passed anything else; no key could be sent at all; and a base URL written
with its `/v1`, as that server's documentation writes it, would have been
asked for `/v1/v1/chat/completions`.

## What Changes

- **`local-llm-settings.ts` in core**: each of base URL, model and key from
  the host where it was told, else from the environment
  (`OPENSPEC_UI_LOCAL_LLM_BASE_URL`, `_MODEL`, `_API_KEY`), else the old
  defaults. The standalone server and the CLI are told through the
  environment with no change of their own.
- **The adapter** sends the key as `Authorization: Bearer`, and reaches
  `/chat/completions` from a base with its `/v1` or without. The
  availability check sends the key too.
- **The editor**: settings `openspec-ui.localLlm.baseUrl` and
  `openspec-ui.localLlm.model`, and a command, **Set Local LLM API Key...**,
  that keeps the key in the editor's secret storage. Read when the window
  opens; the command offers to reload it.
- **HARNESS.md** says where each is set, and that the agent answers in text
  and edits no file.

## Capabilities

### New Capabilities

(none)

### Modified Capabilities

- `execution-core` - where the local LLM is, and its key.

## Impact

- `packages/core/src/local-llm-settings.ts` (new), `agents/local-llm.ts`,
  `default-runners.ts`, `agent-detection.ts`, with tests.
- `packages/extension/package.json` (two settings, one command) and
  `src/extension.ts`; the manifest test lists the command as one that
  asks first.
- `HARNESS.md`.

## Explicitly out of scope

- **Tools for the local LLM.** It answers in text; giving it file edits is
  an agent of its own, not a setting.
- **The editor's optional local server** keeps reading the environment for
  the local LLM, as the standalone does.
