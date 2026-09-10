# A live check names who performs it

## Why

Asked for on 2026-09-10: hand the items marked human-only to
`copilot-cli-acp` or `copilot-cli`.

The repository has one category for a verification the implementing
agent cannot do. `openspec/config.yaml`, `rules.tasks`: "A task that an
implementing agent cannot perform (live, interactive, or manual
verification) must be marked as such in the task text". The marker is
`**Human-only**`, and `isHumanOnlyTask` reads it
(`packages/core/src/task-checklist.ts:38-45`).

That category conflates two different facts. One is "no agent can do
this" — a judgement, a look at a rendered page, a decision about whether
something reads well. The other is "the agent running this change cannot
do this" — a live run, a real VS Code host, a query against GitHub.
The second is not a fact about agents; it is a fact about which agent.

All six items open in this repository today are of the second kind:

| Item | What it needs |
| --- | --- |
| `a-date-is-one-day-in-every-source` 7.5 | a browser over the shell |
| `a-name-is-checked-before-it-is-used` 5.4 | a real VS Code host |
| `a-schedule-keeps-its-promise` 8.5 | a real VS Code host |
| `a-stage-override-keeps-its-custom-agent` 5.4 | a live chain run |
| `dependabot-block-action-majors` 3.5 | a query against GitHub |
| `quality-is-charged-to-the-agent-whose-work-was-checked` 5.5 | a live chain run |

Each is something a CLI agent with tools can do, and the repository
already runs both a Playwright suite and a real VS Code integration
suite. Marking them human-only sends them to a person because the
convention has no way to say "someone else".

The risk of simply deleting the marker is the reason it exists. An item
that an agent may close is an item an agent may claim to have closed
without doing it. So the delegation carries the evidence rule with it:
a delegated item names the agent and the evidence that agent must
produce, and is ticked only with that evidence recorded beside it.

## Capabilities

### New

- A task that needs a live check may name the agent that performs it,
  and the evidence that agent must record before it is ticked.

### Modified

- The inbox of what is not yet closed says who each item waits on — a
  person, or a named agent — rather than showing only the ones waiting
  on a person.
- An item naming an agent that is not registered is reported as such,
  not treated as delegated.

## Out of scope

Running the delegated checks. Five of the six verify work that has not
been implemented yet, and the sixth waits on a Dependabot run due later
today; delegation is the assignment, and each change carries out its own
when it is implemented. One is exercised here as a worked example, for
the part of it that can be answered today.

Automatic dispatch. Nothing in this change makes the harness invoke the
named agent by itself. The name says who does it; a person or a chain
still starts the run.
