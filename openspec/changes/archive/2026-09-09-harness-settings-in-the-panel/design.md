# Design

## Context

`HarnessSettingsView` takes a `HarnessSettingsApi` — five calls:
`resolveGlobal`, `writeGlobal`, `readChangeOverride`, `writeChangeOverride`,
`listCustomAgents`. In the standalone shell each is an HTTP route.

The panel has no server. Its bridge carries a `Command` one way and a
stream of `Event`s the other; neither shape is a question with an answer.
`run-dialog-in-the-panel` needed no answer — the plan arrived as context
and a choice went back one-way — so this is the first thing that does.

## Decision: a correlated request/response message pair

The webview posts `{ type: "openspec-ui/request", id, op, args }` and the
host replies `{ type: "openspec-ui/response", id, ok, value | error }`.
One `id` per call, resolved against a pending map.

This is the smallest thing that works and the most obvious to read. The
alternative — pushing the whole configuration as context and posting
writes one-way — cannot report that a write failed, and a settings form
that cannot say "this was refused" is the defect this project keeps
fixing.

## Decision: the host exposes named operations, not a path

`op` is one of five names, each mapping to a `core` call the host already
makes. It is not a route, a file path or a function name: a message must
not be able to name what it wants read or written. An unknown `op` is
refused with an error, which is what reaches the form.

The `cwd` is not taken from the message either. The host uses its own
workspace root, the same one every command uses.

## Decision: the view mounts on a context flag, like the dialog

`showSettings` in `DashboardContext`, baked into the first render's HTML
for the same reason `startChain` and `runPlan` are: it decides which
component mounts, and a follow-up message would show the wrong surface
first.

## Decision: both commands open the view; the file stays where it is

`Configure Harness` and `Configure Harness for this Change` reveal the
panel. The file is still the configuration and is still hand-editable —
the view names its path, so the person who wants the JSON knows exactly
where it is rather than losing the entry that used to open it.

The seeding both commands do stays: a missing global file is written with
the documented default before anything opens, and a missing per-change
file with an empty override. A view over a file that does not exist yet
would have to explain the difference between "inherits everything" and
"not configured", which the file itself answers.

## Rejected: reusing the run dialog's one-way message

It carries a choice and expects nothing back. Widening it into a general
request channel by adding an `id` and a reply would leave one message type
meaning two different things depending on which field is set.
