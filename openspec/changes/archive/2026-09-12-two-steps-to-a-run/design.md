# Design

## Decisions

**A how-to is a goal, two steps, and a link — and it is refused if it
needs three.** The constraint is the design. A goal that cannot be
reached in two steps is evidence about the product, not about the
document: it says the configuration for that goal is spread too thin,
and the fix is a change to the product rather than a longer page. A
how-to that grows a third step is recorded as an open question in this
change, not padded.

Rejected: a tutorial that walks through the whole harness. That is what
`HARNESS.md` is, and a second one would drift from it. Every how-to
links into the reference for detail and repeats none of its tables.

**They live in `docs/how-to/`, one file per goal, and `HARNESS.md`'s
existing task index links them.** The index at the top of `HARNESS.md`
already maps a task to a key; each row gains the page that does it, so
there is one place a reader starts and two documents behind it.

Rejected: putting the how-tos inside `HARNESS.md`. It is already long
enough that the table of contents is how it is used, and a short path
buried in a reference is not a short path.

**Each how-to states which file it edits, and shows the JSON.** Both
UIs edit the same files, and five settings no UI can edit at all. A
page that says only "open the settings tab" is wrong for the settings
that are not there, so each page names the file and shows the object it
writes.

**The Gemini/Codex finding is written where custom agents are
documented, with the date it was checked and the mechanism each CLI
actually uses.** Not as "unsupported": the reason matters. Discovery is
possible for both; selection is not, because neither documents a flag,
and this repository's mechanism is a flag on an allowlisted invocation.
A prompt-prefix mechanism (`@name`) would put the agent's name inside
the prompt instead of the argument list, which the allowlist does not
constrain — a different security question, and one nobody has asked for
yet.

Rejected: adding `.gemini/agents` and `.codex/agents` to
`custom-agents.ts` now, listing them and greying the selection. A list
whose selection does nothing is the "ceiling that cannot act" defect
`agentsAcceptingCustomAgents` exists to prevent.

## Non-Goals

- Any code change in `packages/`. This change writes documentation and
  edits `HARNESS.md`; a how-to that cannot be written without a code
  change is recorded as a finding instead.
- Changing which settings the UIs can edit.
- Installing or testing the Gemini and Codex CLIs. The finding is what
  their published documentation states, dated, and it says that.

## Risks / Trade-offs

**Documentation that duplicates a reference goes stale.** Mitigated by
the link rule: a how-to states the goal, the file, the two steps and the
object to write, and every table, accepted value and default stays in
`HARNESS.md` alone. A verification task greps the how-tos for the
per-agent effort values and the accepted-key list to prove neither was
copied.

**A published convention can change.** The two CLIs' documented
behaviour was read on 2026-09-12 and is recorded with that date, which
is the same treatment `custom-agents.ts` already gives its own
"verified on 2026-09-09" note.

**No protocol impact.** No command, event, or adapter is touched.

## Could not be done in two steps

Empty, and written out rather than left off: all six goals reached their
outcome in two steps against the configuration as it stands, so this
change reports nothing about the product's shape.

Two came close enough to record. **Handing a task to an agent** is two
steps only because the marker in `tasks.md` is enough on its own —
naming a different agent, or one of your own definitions, for that task
is a third edit in a different file, and the page shows it as a variant
rather than as a step. **Capping what a run can spend** is two steps
because both ceilings live in the same object; a reader who set only the
money ceiling would be done in one step and would have no ceiling with
any force over the six agents that report no usage, which is why the
page sets both.
