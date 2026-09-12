# Design

Builds on `docs/adr/0013-acp-agent-adapters.md` and
`docs/adr/0017-structured-agent-output-parsing.md`, and on the
activity line introduced by `an-agent-says-what-it-is-doing`.

No new ADR. ADR 0013 already decided that `claude-cli-acp` is the
ACP-flavored counterpart for Claude and translates Claude's structured
progress; this change makes that translation land in ACP's shapes
rather than beside them. ADR 0017's rules — parsing never changes a
run's outcome, degradation is per field — apply unchanged.

## Decision: the imitation is completed in the adapter, not recognised downstream

The alternative was a reader that understands both ACP and Claude's
stream-json, used by every surface.

Rejected. Every surface would then depend on Claude's undocumented
format, which ADR 0017 ranks as the weakest structured surface, usable
only against a pinned version. That knowledge would live in a module
every surface imports, and the next adapter that imitates ACP would add a
second branch to it, and a third.

Translating in the adapter keeps one protocol downstream. A surface
reads ACP and does not know which agent produced it. Claude's format is
known in exactly one file, the one that already parses it.

## Decision: the mapping

| Claude stream-json | ACP session update |
|---|---|
| `assistant`, content block `text` | `agent_message_chunk`, content `{ type: "text", text }` |
| `assistant`, content block `thinking` | `agent_thought_chunk`, content `{ type: "text", text }` |
| `assistant`, content block `tool_use` named `TodoWrite` | `plan`, one entry per todo |
| `assistant`, any other `tool_use` block | `tool_call`: `toolCallId` from the block's `id`, `title`, `kind`, `status: "in_progress"`, `locations`, `rawInput` from the block's `input` |
| `user`, content block `tool_result` | `tool_call_update`: `toolCallId` from `tool_use_id`, `status` `failed` when `is_error` is true and `completed` otherwise, and the call's `title` again |
| `system`, `result`, and any other line | unchanged: `sessionUpdate` is the line's `type`, and the line is spread in |

One line can carry several content blocks. It becomes several updates,
in the order of its blocks.

The `result` line keeps doing everything it does today: it decides the
run's terminal event and reports usage.

A `TodoWrite` call becomes a plan rather than a tool call, so its result
has no call to update. The adapter remembers which ids it turned into
plans and drops their results.

A plan entry's `status` takes Claude's todo status directly; both use
`pending`, `in_progress` and `completed`. ACP requires a `priority` and
Claude reports none, so the adapter writes `medium`. Nothing in this
product reads priority, and a schema-valid imitation is worth more than
leaving a required field out.

## Decision: the adapter writes the title

ACP's `title` is "a human-readable title describing what the tool is
doing". A native agent writes its own. For Claude, only the adapter knows
that `Read` takes `file_path` and `Bash` takes `command`, so the adapter
writes it:

| tool | title | kind |
|---|---|---|
| `Read` | `Read <path>` | `read` |
| `Write`, `Edit`, `MultiEdit`, `NotebookEdit` | `<tool> <path>` | `edit` |
| `Bash` | `Bash: <first line of the command>` | `execute` |
| `Grep` | `Grep "<pattern>"`, plus ` in <path>` when one is given | `search` |
| `Glob` | `Glob <pattern>` | `search` |
| `WebFetch` | `WebFetch <url>` | `fetch` |
| `WebSearch` | `WebSearch "<query>"` | `fetch` |
| `Task`, `Agent` | `Agent: <description>` | `other` |
| any other tool, or a known tool missing its field | the tool's name | `other` |

A path in a title is relative to the run's working directory when it
lies inside it, so a line reads `Edit packages/core/src/index.ts` rather
than a drive letter and a user directory. `locations` keeps the absolute
path, as ACP requires.

The title of a `tool_call_update` repeats the call's title. The reader
below is stateless, and a failure it cannot name is not much of a
report.

## Decision: a whole message is one chunk, ending in a line break

Without `--include-partial-messages`, Claude sends a message whole, not
in slices. Two messages in a row would otherwise be joined by the panel
and the terminal into one sentence that was never written. The adapter
ends each text chunk with a line break when it does not already end with
one.

## Decision: the source block travels in `_meta`

Each translated update carries the content block it came from under
`_meta["openspec-ui/claude-stream-json"]`. ACP reserves `_meta` for
exactly this and says a receiver must assume nothing about it, so no
surface reads it. It is there for a person reading the JSON-lines output
of a run that looked wrong.

The whole line is not repeated: a line with three blocks would carry
itself three times.

## Decision: one reader, in core, knowing ACP only

`describeAcpUpdate(update)` in a leaf module beside
`acp-streamed-text.ts`, with no Node built-ins, so the browser bundle can
carry it. It returns a line or `undefined`:

| update | line |
|---|---|
| `tool_call` | its title |
| `tool_call_update` with `status: "failed"` | `failed: <title>`, or `a tool call failed` when it has no title |
| any other `tool_call_update` | `undefined` — a call just shown finishing is noise; the next call says more |
| `plan` | `plan <completed>/<total>: <the in-progress entry>`, or `plan <completed>/<total>` when none is in progress |
| `agent_message_chunk`, `agent_thought_chunk` | `undefined` — prose belongs to `readAcpStreamedText` and is joined by the surface |
| anything else | `undefined` |

A title is reduced to its first line and trimmed. Shortening to fit is
the surface's business: a terminal and a panel have different widths.

`undefined` for anything unrecognised, for the reason
`readAcpStreamedText` gives: ACP is not this project's protocol, and a
shape nobody here has seen is not guessed at.

## Decision: what each surface shows

| surface | streamed text | tool call, failure, plan | anything else |
|---|---|---|---|
| AI panel | joined prose, unchanged | the line | `agent update: <kind>`, unchanged |
| VS Code output channel | the text itself | `[agent] <line>` | `[agent update] <kind>`, unchanged |
| terminal, text | joined prose, unchanged | `· <line>` on a line of its own | nothing, unchanged |
| terminal, JSON lines | the whole event, unchanged | the whole event, unchanged | the whole event, unchanged |
| status record activity | the last line of text, unchanged | the line | nothing, unchanged |

The output channel showed a text chunk as its kind; it now shows the
text, as it already shows `stdout`.

## Non-Goals

Token-by-token streaming. `--include-partial-messages` exists, but one
update per message and per tool call is enough to see what an agent is
doing, and partial messages multiply the events every surface handles.

Showing what a tool returned — file contents, command output — on any
surface.

A permission gate for `claude-cli-acp`. ADR 0013 records why there is
none.

Any change to the native ACP adapters or to the session driver.

Folding a tool call and its update into one entry in the panel.

## Risks / Trade-offs

Claude's stream is undocumented. Following ADR 0017, a block of an
unknown type is skipped, and a line from which nothing was translated is
forwarded exactly as today, so a renamed field loses that field's
translation and nothing else. The mapping is verified against
`VERIFIED_CLAUDE_CLI_VERSION`, 2.1.237, which is the version installed
here on 2026-09-13.

Anything that read Claude's raw shape out of an `agentUpdate` changes.
Searched on 2026-09-13: only `claude-acp.test.ts` asserts
`sessionUpdate === "assistant"`, and the panel's lax text extractor
names the assistant update in a comment. Live usage reads ACP's
`usage_update` only. The `permission_denied` test reads a `system` line,
which is forwarded unchanged.

A command in a title is shown on every surface and written into the
status record, which is a file on disk beside the repository. That same
command already reaches every surface today inside the forwarded line;
the status record is new exposure, but local to the user's own machine,
and the audit log does not receive it.
