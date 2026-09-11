# A stage override keeps its custom agent

## Why

Found by the code review of 2026-09-10. Two changes that each work alone
disagree where they meet.

**The merge drops the custom agent.** `stage-override-keeps-the-rest`
taught `mergeStepAgent` (`packages/core/src/harness-config.ts:780-798`)
to carry model, effort and budget across a per-change override.
`custom-agents-reach-the-cli` added a fourth field, `customAgent`, and
did not teach the merge about it. The global file sets `apply:
"claude-cli"`; a change's `harness.json` sets `apply: {agent:
"claude-cli", customAgent: "reviewer"}`; the resolved configuration is
`apply: "claude-cli"` and the chain runs without `--agent reviewer`,
silently. The reverse direction drops it too. The tests added with the
custom-agent change write only the global file and never exercise the
merge. `templateConfigToWrite` handles the same merge by spread and
keeps the field, so the two disagree.

**Two surfaces apply the same configuration to the same change and
write different files.** The run dialog applies a template against the
resolved configuration (`run-with-harness-dispatch.ts:110-118`), so an
inherited agent gets an effort. The settings view applies it against the
override's own form (`HarnessSettingsView.tsx:102-109, 480-492`), where
every stage the override does not name is "inherit", so nothing gets an
effort — and the message says "None of the agents on screen takes an
effort setting", which is not the reason.

**The prose does not match the arithmetic.** The balanced configuration
says "the middle of this agent's range" (`harness-templates.ts:114`) and
`HARNESS.md:364` says "the highest, high, medium or lowest of what the
agent accepts". The mapping is thirds, deliberately, and for `copilot-cli`
the medium level resolves to `low`, the third of seven; for `claude-cli`
the high level resolves to `xhigh`. The table in `presets-by-effort`'s
design records these values, so the mapping is what was decided; the
sentences are what is wrong. And `HARNESS.md:64` still says four agents
accept no effort where line 367 says five; five is correct.

## Capabilities

### Modified

- A per-change stage entry inherits and overrides `customAgent` by the
  same rule as model, effort and budget.
- Applying a named configuration to a change writes the same file from
  the run dialog and from the settings view, and the message names the
  real reason when no effort was set.
- The effort a configuration resolves to is described by its position in
  the agent's range, in words that are true for every agent.

## Out of scope

Changing the thirds mapping. It was chosen so that four levels stay
distinct over four values, and the design records why.
