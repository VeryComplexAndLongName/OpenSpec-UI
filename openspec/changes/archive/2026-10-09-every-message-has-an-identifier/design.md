## Context

ADR 0046 sets the form, the groups, the register, the page and the ratchet,
and says the register comes first with four groups. This change is that
first step. The other groups move in later changes, a few at a time.

## Decisions

1. **One register, a leaf in core.** `MESSAGES` maps each identifier to its
   level, its words with `{name}` where a value goes, why it is said and
   what to do. It imports nothing, so the CLI, the extension and the webui
   read the same one. The values a message's words name are typed from the
   words themselves: `say("OSW-QST-003", { question, change })` does not
   compile with one missing.
2. **The words stay.** Each message moved here keeps the words it had, so a
   test, a log reader or a person who knew it still finds it. What a
   message gains is its identifier. The CLI's own lines are the exception
   ADR 0046 asks for: `openspec-ui-cli: <words>` becomes `error
   OSW-CLI-003: <words>`.
3. **Two ways of saying one message.** On a line of its own - a CLI error -
   it is `<level> <identifier>: <words>`. After a mark that already says how
   a run ended - `✗`, `[failed]`, `Failed:` - the level would say it twice,
   so the identifier leads the words alone: `✗ OSW-RUN-104: ...`. A message
   not yet in the register is said as before.
4. **The identifier rides the event, beside the words.** `progress`,
   `failed` and `cancelled` gain an optional `code`; `reason` and `message`
   keep the words alone, so a reader that ignores `code` reads what it read
   before, and the JSON a CLI run prints carries it with no more work.
5. **The hundreds say when.** 0xx before anything runs (an argument, a
   refusal), 1xx while it runs, 2xx as it ends (a limit, an interruption).
   That kept ADR 0046's example true: an `apply` that did nothing is
   `OSW-RUN-104`. A number once given is listed in the test and never
   leaves it; a message that goes is marked `retired`.
6. **The page is generated, and held.** `npm run messages --workspace
   @openspec-ui/core` writes `docs/messages.md`; a test fails while the
   page differs from what the register says, as the harness schemas'
   test does.
7. **A rough ratchet.** The test counts four forms that say a sentence in
   place: a literal to `stderr(`, to a VS Code notification, to
   `failedEvent(`, and a literal `reason:`. It counts most of what a person
   reads and none of what is said by identifier. 323 on `main` before this
   change, 290 after; the number may only fall, and the test names the
   new number when it does.
8. **By subject, not by file.** A file the CLI group touches can keep a
   message of another group said in place - "is not a change here" is
   `CHG`'s, "could not read the workspace lease" `WSP`'s. They move with
   their groups.

## Risks / Trade-offs

- **A script that read `openspec-ui-cli:` at the start of a CLI error.**
  Errors now start with their level and identifier; the exit codes are
  unchanged, and they are what a script should read.
- **The ratchet counts forms, not messages.** A sentence built elsewhere and
  passed in is not counted. It is a floor to hold, not a census.
