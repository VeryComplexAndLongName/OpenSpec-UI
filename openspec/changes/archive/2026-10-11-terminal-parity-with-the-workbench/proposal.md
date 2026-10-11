# Proposal

## Why

ADR-0020 made the CLI a way to run a change, while ADR-0045 gave every surface
the same action vocabulary. Twelve agreed terminal actions are still absent:
operators cannot inspect tasks, read prior run output, explain configuration,
or use the existing message and delegated-task facilities without the UI.
ADR-0001 requires these commands to reuse core behavior rather than fork it.

## What Changes

Add twelve public verb-and-noun pairs, preserving every existing command:

| Command | Purpose |
| --- | --- |
| `rollback change <change>` | Confirmed restoration from eligible recorded checkpoints |
| `explain change-harness <change>` | Effective configuration used by the terminal |
| `show run <runId>` | Recorded run details and retained output |
| `show agents` | Registered agents, providers and terminal capabilities |
| `explain message <code>` | Message template, severity, reason and remedy |
| `show cost <change>` | Recorded usage across repository worktrees |
| `show changes` | Active changes, stages, task progress and blockers |
| `show tasks <change>` | Task numbers, text, evidence and closure responsibility |
| `show diff <change>` | OpenSpec artifact diff, including staged and untracked files |
| `send message <instanceId> <text>` | Signed note to a live run, without claiming delivery |
| `run task <change> <number>` | Run exactly one declared delegated task |
| `explain change <change>` | Factual summary and evidence-backed next actions |

Support `--cwd` and text/JSON presentation consistently. Keep core's ownership,
worktree, lease, sandbox, confirmation and accounting rules. Document identifier
and diff scope limitations explicitly. Add a minor CLI changeset during apply.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `ci-cli`: twelve additional inspection, recovery and operator commands.

## Impact

`packages/cli` routing, argument handling, focused handler modules, existing
tests and README. Reuse exported core readers/services; add only genuinely
missing orchestration or reporting behavior in core, with focused tests.
New diagnostic identifiers belong in the core message register, not inline
strings. Their generated documentation must follow the existing generator.

No UI/server transport change is planned. No website visibility change,
npm authentication fix, deploy, commit or implementation is part of preparing
this proposal. This replaces the empty, previously reverted planning entry
under the same change id; it does not duplicate an implemented capability.
