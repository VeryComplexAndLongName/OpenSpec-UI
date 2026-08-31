---
"@openspec-ui/core": patch
---

Fix `copilot-cli` `plan`/`review`/`implement` runs failing outright
(`copilot exited with code 1`, no work done) for any change whose combined
`proposal.md`/`design.md`/`tasks.md`/delta-spec content is large — a
direct side effect of the `agent-prompt-context` fix, which made prompts
carry real content instead of being nearly empty. `copilot -p` delivers
the prompt only as a positional CLI argument (no stdin path), and
cross-spawn resolves its npm-global `.cmd` shim through `cmd.exe`, whose
own command-line length budget (~8191 characters) is easy to exceed once
real file content is embedded. `CopilotCliAdapter` now falls back to a
short prompt naming the change's directory and instructing the agent to
read its files itself (it already runs with `--allow-all-tools`) whenever
the full embedded prompt would be too large, instead of failing.

See `openspec/changes/copilot-prompt-length-limit/` for the full
diagnosis (reproduced live; the raw stderr bytes decode as CP866 to the
Russian-language OS text for "the command line is too long").
