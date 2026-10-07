## Context

`readChangeStages` turns every audit entry of a change into an
"in-progress" fact, and a stage only moves forward, so the first run of any
kind - `propose` included - put a change In progress for good. The audit
entries of a single run recorded no command, only a chain's recorded its
stage.

The AI panel's status line held the whole summary (`Completed: …`), the run
analysis held it again (`Result: …`), and the log held the `completed`
event and the agent's last message, which for an ACP agent is the summary.
All three drew it as plain text. Each log line had its own framed box.

## Decisions

1. **The run's entry says what it was asked to do.** `AuditEntry.command`,
   the command's kind, on a run's `started` and terminal entries.
2. **Only work on the implementation moves a change In progress.**
   `isWorkEntry`: an `implement` or `verify` command; a chain stage among
   `apply`, `verify`, `git`; the verify checks' entry; a run on one task.
   An entry naming neither its command nor its stage - every entry written
   before decision 1 - does not count; the stage the files and git give
   stands for it. Rejected: counting such entries as before, which would
   keep every change already run with `propose` In progress.
3. **The result once, rendered.** The status line says `Completed`; a Result
   section renders the summary with the Markdown renderer the rest of the
   UI uses; the run analysis keeps its counts and the last highlight, not
   the result. The log leaves out `completed` events and the agent's last
   message where it is the summary (the same text, or one holding the
   other, past 40 characters).
4. **The log reads as text.** What the agent said renders as Markdown in
   the UI's font; a tool call, a start and a usage figure are muted lines;
   no line has a frame. Scoped to the log, since the usage summary draws
   its rows with the same classes. A text agent's printed output renders
   as Markdown too; a CLI's JSON is still drawn as its card.
5. **Tool calls are counted.** The run analysis says how many tools an ACP
   agent called; its "Steps" still counts numbered steps a text agent
   printed.

## Risks / Trade-offs

- **Old audit logs lose their In progress evidence from runs.** Closed
  tasks, commits on the branch and pull requests still move a change on.
