# Custom agents are visible and choosable

## Why

Claude and Copilot both let a person define a custom agent — a named
preset with its own instructions and tools — and both accept it on the
command line. Verified on this machine:

- `claude --agent <agent>`, definitions in `.claude/agents/*.md`,
  project-level or user-level.
- `copilot --agent <agent>`, and its help names `.github/agents` as
  trusted configuration.

This project cannot see them, cannot offer them, and cannot pass one. A
person who has built a reviewer agent for their repository has to run it
by hand, outside the harness that exists to run their stages.

Neither CLI has a command that lists them, and the earlier attempt to ask
a CLI for its models found no such command either. But there is nothing
to ask: the definitions are files in known directories, and reading a
directory is something this project does constantly.

## Capabilities

### New

- Custom agents defined for Claude and Copilot are discovered and offered
  where a stage's agent is chosen.

### Modified

- A stage may name a custom agent, and it reaches the CLI.

## Out of scope

Gemini and Codex. Their CLIs are not installed on the machine this was
written on, so their convention could not be verified, and inventing a
directory for them would be a feature that reads nothing. The discovery
takes a per-family convention, so adding one later is data rather than
design.

Creating or editing a custom agent. They are files their own tools
already manage; this reads them.
