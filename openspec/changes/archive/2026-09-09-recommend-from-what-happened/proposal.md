# Recommend from what actually happened here

## Why

The run dialog now shows what runs have cost in this workspace, and a
person has to read three rows of medians and draw the conclusion
themselves.

The conclusions are the easy part and the figures already support them.
On this repository's own log: `claude-cli-acp` is both the only agent
that reports a cost and the one with the highest completion rate, and
`claude-cli` takes 2.4 times as long as it for the same work. "Cheapest",
"fastest", "most likely to finish" are readable straight off that, and
nothing reads them.

The named configurations in the second box are decided in advance and
work in an empty workspace. These are decided by this workspace, name
what they are recommending rather than an intent chosen months ago, and
exist only where the observations support them.

## Capabilities

### New

- Recommendations derived from the workspace's own recorded runs, each
  named for what it is recommending and carrying the observation behind
  it.

## Out of scope

Quality. "Which agent produces work the verifier accepts" is the question
worth asking and nothing records the answer yet: the audit log has
outcomes, costs and durations, and nothing about what a review found.
Recording it comes first, and it is its own change.

Applying one. These name an agent and an effort; whether choosing one
writes the configuration is the same question the named configurations
already answer, and it is answered the same way.
