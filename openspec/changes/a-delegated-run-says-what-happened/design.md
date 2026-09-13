## Context

- `task-checklist.ts` takes a task line's first bold span as its lead
  (`HUMAN_ONLY_LEAD_RE`) and `delegatedAgentFor` matches the whole lead
  against "delegated to" followed by one id of registry shape — letters,
  digits, dots, underscores and hyphens. A backtick is none of those, so
  a quoted id matches nothing and the item names no agent.
- `runDelegatedItem` (`delegated-item-run.ts`) iterates
  `runner.run(command)`, passes each event to `onEvent` when a host gave
  one, and keeps the outcome and the `failed` event's `reason`. Neither
  host gives `onEvent`. The `stderr` events — `{ kind: "stderr", chunk }`
  — are dropped.
- `withAgentStatus(events, command, seams)` (`agent-status.ts`) keeps a
  status record for any command of a reported kind, `implement`
  included, and names the change from `command.context.changeDir`. The
  CLI, the standalone server and the extension wrap their run loops in
  it; `runDelegatedItem` builds an `implement` command and does not.

## Decisions

**A quoted id is accepted as a pair, and only as a pair.** Both
``Delegated to `claude-cli` `` and `Delegated to claude-cli` name
`claude-cli`. A backtick on one side only names nothing: a half-quoted
id is a typo, and a typo must not quietly become a name. Markdown
authors put ids in backticks by habit; refusing the habitual form made
the marker a trap that no check reported.

**The stderr tail is taken in core, from the run's own events.** The
last 20 lines, and at most 2,000 characters, of everything the run wrote
to stderr. Only on a `failed` or `cancelled` result: a run that finished
has nothing to explain. Stderr and not stdout, because agents print
their work on stdout, and stderr is where a command line tool says why it
stopped. Bounded, because the result travels over HTTP to one row of a
list and into a notification.

**The message quotes the last non-empty stderr line.** "The run failed:
claude exited with code 1. It last said: API Error: 400 …". The whole
tail goes on the result as `lastStderr`, for a surface with room for it.
Nothing is added when the run wrote nothing to stderr.

**The status record is kept by `runDelegatedItem` itself.** It wraps
`runner.run(command)` in `withAgentStatus`, rather than each host
wrapping its call: two hosts would both have to remember, and the point
of this change is that one place forgot. Events still reach `onEvent`
unchanged and in order.

**A test seam for the status directory.** `runDelegatedItem` accepts
`resolveStatusDirectory`, handed to `withAgentStatus` as its
`resolveDirectory`, so a test can keep the record in a temporary
directory without a git repository.

## Risks

- A stderr line can carry something an agent should not have printed.
  The result goes back only to the person who asked for the run, on
  their own machine, through the token-authorised local server or the
  extension, and is not written to the audit log. It is bounded, and it
  is the same text the terminal would have shown.
- Accepting a quoted id makes some existing markers readable. Only open
  items are listed, and every item carrying the quoted form today is
  closed.
