# The run dialog shows what runs cost here

## Why

`buildWorkspaceRunStats` reads the audit log back as an aggregate — what
each agent's runs cost, how long they took, how many finished — and
nothing shows it. The run dialog, which is where a person decides what to
spend, does not have it.

The standalone shell cannot reach it on its own: the figures come from
`.openspec-ui/audit.jsonl` and from which changes still exist, and the
browser can read neither. That is the same limit recorded twice before,
and twice it was taken as a reason not to try. Once it turned out to be
half untrue — the task list was always available over HTTP — and the
recommendation moved into the dialog on that discovery.

This one is not half untrue. It needs a route. The difference is that the
figures are now the point rather than an ornament, so the route is worth
its cost.

## Capabilities

### New

- The workspace's recorded run figures are served to the standalone
  shell.
- The run dialog shows them, with what they rest on.

## Out of scope

Choosing a configuration from the figures. This shows what has happened;
proposing what to do about it is the next change, and it needs a rule for
turning a distribution into a proposal that is worth arguing on its own.

The named configurations and the custom one. They come next, and they
sit in a second box beside this one.
