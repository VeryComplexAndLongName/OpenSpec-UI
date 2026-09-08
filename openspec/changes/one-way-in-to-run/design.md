# Design

## Context

Three ways a change can be worked on today, and two entries leading to
them:

| Path | Reached by | Reads the config |
| --- | --- | --- |
| Chain (`propose → … → git`) | `runWithHarness`, when not `assisted` | yes |
| Single-stage picker | `runWithHarness`, when `assisted` | yes |
| VS Code Chat, agent mode | `startImplementation` | no |

The third is not a separate universe: `vscode-chat` is already a valid
step agent (`VSCODE_CHAT_STEP_AGENT_ID`), so "implement with the VS Code
agent" is, in the model this project already has, the `apply` stage run
by that agent. It only looks separate because it has its own command.

## Decision: one entry, and it shows the decision before making it

`Run` asks for the change, then shows what the resolved configuration
says it will do — which path, which agent, what ceilings — and starts it.

Showing the resolved decision is the same principle this project has now
applied four times: a surface that acts on a configuration has to show
what it read. `runWithHarness` today makes exactly this decision and
shows nothing, which is why "it just changed tabs" is a reasonable thing
for a person to think.

## Decision: the configuration decides, and the person may override for
one run

The dialog pre-selects what the configuration resolves to and lets it be
changed for this run only, without writing the file.

Both halves matter. Always asking would make the configuration pointless
and would ask the same question every day. Never asking is today's
behaviour, and it is what makes the third path need its own command.

An override is not written to `harness.json`. A run is not a
configuration change, and a dialog that quietly edited the file would
make the next run different for a reason nobody recorded.

## Decision: the removed entry becomes an option, not a shortcut

`Implement with VS Code Agent` disappears as a command and appears as a
choice of who runs `apply`. Keeping it as a second entry "for
convenience" is what produced the split in the first place.

## Rejected: keeping both entries and renaming them

Clearer names would help someone who already knows the difference. The
difficulty is not that the names are unclear — it is that the difference
is a configuration value, so a name cannot express it. Two entries whose
correct choice depends on a file neither of them shows is the defect.

## Rejected: a wizard

There is already a wizard for configuring the harness
(`setUpAgenticHarness`). Asking the same questions again at run time
would make the configuration advisory, and this project has been
consistent that a setting nothing reads is worse than no setting.

## What this does not decide

Whether a run can be scheduled rather than started now. The dialog is
where that would live — "now" and "at a time" are the same question asked
once — but the timer is its own change with its own argument about what
happens when the process is not running.
