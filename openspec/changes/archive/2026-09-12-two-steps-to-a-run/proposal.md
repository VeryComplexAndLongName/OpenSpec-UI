# Two steps to a run

## Why

`HARNESS.md` documents nine top-level configuration keys, a per-agent
effort table, a stage sequence, a mechanical-check set, and a table of
which five settings no UI can edit. It is accurate and it is a
reference: organised by key, answering "what does this setting accept".

Raised in review on 2026-09-12: the settings keep growing and the tool
is getting harder to start using. Both halves of that are true, and the
second is not fixed by removing settings. `setup-offers-only-what-applies`
and `an-autonomy-level-says-what-it-does` each made one field easier to
read; a person who wants to run a change unattended still has to
assemble that answer out of `autonomyLevel`, `checkpoints`,
`reviewGate`, `stepAgents` and a budget, from a document organised by
none of those goals.

`HARNESS.md` already admits the shape of the fix in its own first table
— "Hand one numbered task to an agent → `taskAgents`" — which is a
task-to-key index with nowhere to send the reader except back into the
reference.

The same review asked whether custom agents configured for Gemini and
Codex can be offered the way Claude's and Copilot's are. The answer is a
documentation fact, and it belongs with the rest of what
`HARNESS.md` says about custom agents:

- **Gemini CLI** reads subagents from `.gemini/agents/*.md` and
  `~/.gemini/agents/*.md` — Markdown with YAML frontmatter, the same
  shape Claude uses. It documents **no flag** that selects one for a
  single non-interactive run: selection is `@name` at the start of the
  prompt, or the interactive `/agents` command.
- **Codex CLI** reads subagents from `.codex/agents/*.toml` and
  `~/.codex/agents/*.toml` — TOML, whose `name` field, not the file
  name, is the agent's name. It documents no `codex exec` flag that
  selects one either; delegation is named in the prompt.

So `customAgentFlag`, which is what this repository's `customAgent`
support is built on, has nothing to bind to in either CLI. That is worth
writing down: the question will be asked again, and "we checked, and
here is what they accept" is the only answer that stops it being
re-derived.

## Capabilities

### New

- A short how-to per common task, each stating the goal, the two steps
  that reach it, and a link into `HARNESS.md` for the detail — reached
  from `HARNESS.md`'s existing task index and from `README.md`.

### Modified

- `HARNESS.md`'s custom-agent section states what Gemini's and Codex's
  CLIs actually accept, and why neither can be offered a custom agent
  the way Claude's and Copilot's can.

## Out of scope

Any change to what a setting does, or to which settings a UI can edit.
This change writes paths through the configuration that exists.

Discovering or offering Gemini and Codex custom agents. Their
definitions could be listed — the conventions are data — but nothing
could be done with a selection, because neither CLI documents a flag to
pass one. Offering a picker that cannot change what runs is worse than
offering none. If either CLI gains a flag, that is its own change, and
this one leaves the finding recorded for whoever proposes it.

Named configurations. "Give me a sensible configuration in one action"
is already answered: `HARNESS_TEMPLATES`
(`packages/core/src/harness-templates.ts`) offers four, chosen by the
effort they ask for, in the same settings view. A how-to and a named
configuration answer the same complaint differently — one explains what
a person is choosing, the other chooses for them — and each page here
names the configuration to start from where one applies.
