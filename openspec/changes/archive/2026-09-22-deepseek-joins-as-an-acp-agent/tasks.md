Asked by the owner on 2026-09-21: add DeepSeek to the supported agents.

## 1. The agent

- [x] 1.1 `DeepSeekAcpAdapter` (`deepseek-cli-acp`): `dsh --profile acp`
  through the shared ACP driver, with the literal-instructions preamble.
- [x] 1.2 Registry, default allowlist (exactly `--profile acp`), runners,
  capabilities (`reports: "none"`, measured).
- [x] 1.3 A run that closes before the agent says anything names the Node
  on its PATH.

## 2. Documentation

- [x] 2.1 `HARNESS.md` (both agent tables, and the Node requirement),
  `LIMITS.md` (no cap, reports nothing), `README.md`, the extension's
  description; the harness schemas regenerated.

## 3. Checks

- [x] 3.1 Live, 2026-09-22: `initialize` and `session/new` answered by
  `deepseek-harness-acp`, with V4-Flash and V4-Pro offered.
- [x] 3.2 Live, 2026-09-22: an implement run through the product's runner,
  allowlist and run log, in a throwaway repository with one task (create
  `hello.txt` containing `hello`). With the system Node 24.18 first on the
  PATH it completed in 22 s: the file written exactly, the task ticked,
  24 updates, a log of reasoning, tool calls and reply, no permission asked,
  no usage reported. On this repository's Node 22.11 it closed at once, and
  the run now says "dsh exited before answering, and the Node on this PATH
  is v22.11.0".
- [x] 3.3 Tests: the invocation, the preamble, events passed through, a
  silent exit explained and a spoken failure left alone (5); the allowlist;
  detection; the agent picker's lists in `AiPanel.test.tsx`.
- [x] 3.4 `npm run typecheck && npm run lint && npm run test` at the root,
  after `git add`, run unpiped. typecheck and lint pass. Tests: cli 175,
  core 1770 and 37, extension 483, server 114, webui 650 of 651. The one
  failure is `packages/webui/scripts/build-metro-icons.test.mjs`, which
  fails on Windows for its line endings and fails the same way on untouched
  `main`.
- [x] 3.5 The extension's integration suite passes: 18 passing. The whole
  standalone browser suite passes: 28 of 28. A first run on a loaded
  machine (12 minutes against the usual 7) missed `standalone.spec.ts`'s
  15-second wait for "Saved"; that spec alone passed, and so did the whole
  suite run again.
- [x] 3.6 A changeset: core, the server and the extension, minor.
- [x] 3.7 `openspec validate deepseek-joins-as-an-acp-agent --strict`.
