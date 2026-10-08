## Context

See ADR 0042. What exists: `permissionRequest`/`resolvePermission` and the
checkpoint as blocking waits, with `waiting` in the status record
(`agent-status.ts`); the `Starting task` marker read from a run's stream
(`task-marker.ts`, `agent-status.ts`); operator messages handed to the next
stage (`buildOperatorMessagesSection`); the run's message channel between
hosts (ADR 0028); the Human-Only Inbox over `tasks.md`; the supervisor's
"run waits on you" suggestion.

## Decisions

1. **The marker.** Every agent stage's instruction (`plan`, `review`,
   `update`, `implement`, `verify`) ends with: "If you need a decision from
   the operator that the change's files do not make, do not make it
   yourself: print a line of its own reading `Question for the operator:
   <the question>`, one line per question, with the options you see in
   it, and stop before work that depends on the answer." `operator-
   question.ts` reads it as `task-marker.ts` reads its marker: start of
   line, list and quote marks and emphasis tolerated, the text after the
   colon kept, an empty one ignored, the same text twice in one run read
   once.
2. **The event and the command.** `question` (non-terminal): `questionId`
   (`Q-<first 8 letters and digits of the run id>-<n>`) and `text`; the
   stage, agent and time are in `decisions.md`, not repeated on the event.
   `awaitingAnswers` lists the questions the run waits on when its turn
   ends, and `questionAnswered` (`questionId`, `answer`, `by`) says each
   answer was recorded. `answerQuestion`: `questionId`, `answer`; who
   answered is the answering host's git identity. The runner emits
   `question` as soon as it reads the marker, so the card shows it while
   the agent still works; the status record's `waiting` becomes
   `{ kind: "question", questions: [...] }` on `awaitingAnswers`.
3. **Waiting instead of completing.** `withOperatorQuestions`
   (`operator-questions-runner.ts`) wraps every default runner, so the
   agent runner itself is unchanged. It holds the agent's own `completed`
   while any question the pass asked is still open, as the chain holds a
   `failed` under `act` (the-supervisor-changes-agents): it emits
   `awaitingAnswers`, and blocks on the answers, reading `decisions.md`
   every 3 s and at once when an `answerQuestion` reaches the same runner.
   When the last one is answered, it runs the stage again in the same run -
   `update` for `plan` and `review`, the same command otherwise - with a
   prompt section "The operator's answers" holding each question and
   answer, and its outcome is the run's. Only questions still open when
   the pass ends are waited on: a question `ask_operator` had answered in
   the turn needs no second pass. A chain runs its stages through these
   runners and so waits in the stage; its checkpoint logic is untouched,
   and the stage's time limit does not count the wait. The terminal-event
   contract (ADR 0012) holds: one terminal event, last.
4. **`ask_operator`.** A tool of `local-llm-acp` with one argument,
   `question`. Its execution says the question as a marker line, so it is
   recorded through the same path, and waits for its answer in
   `decisions.md` (read every 1.5 s); the answer is the tool's result, and
   the turn goes on. It is not offered under `local-llm` (text only).
   `local-llm-acp`'s stage instruction tells it to ask with the tool rather
   than print the line: told the line, the model printed it and ended its
   turn (live, 2026-10-08), which still works but costs a second pass.
5. **`decisions.md`.** `decisions-file.ts` appends, never rewrites another
   entry:

   ```
   ## Q-<run>-<n>: <question>

   - Asked: <time> by <agent>, stage <stage>, run <run id>
   - Answer: (open)
   ```

   and on answer replaces that entry's `Answer:` line with the answer,
   followed by `- Answered: <time> by <who>`. Written in the change's own
   worktree. The audit log records an entry for each question and each
   answer, with an `operatorQuestion` field (`questionId`, `text`, and
   `answer` and `by` once answered). `openQuestions(changeDir)` reads the
   file.
6. **The refusal.** The same wrapper refuses an agent command (`plan`,
   `review`, `update`, `implement`, `verify`) on a change whose
   `decisions.md` holds an open question - in the command's own directory
   or in the change's own worktree, so a run started from the checkout
   does not go past a question its chain asked there - with "<change> has an open
   question for the operator: <Q-id> "<text>". Answer it first - on the
   change's card, with `openspec-ui-cli answer <change> <Q-id> "<answer>"`,
   or in its decisions.md." A chain is refused at its first stage, which
   runs through it. Read-only commands run.
7. **Surfaces.** A card with open questions offers **Answer...**, a field
   per question; it reads them from the change's `decisions.md` through
   the survey, so they show whether or not the run that asked is alive.
   The AI panel and the chain panel show the questions of the run they
   watch the same way. The Human-Only Inbox lists open questions from the
   checkout's changes and from each change's own worktree, first, and
   answers them (an inline **Answer This Question...** in VS Code, a field
   in the standalone app). `openspec-ui-cli answer <change>` lists a
   change's open questions and `answer <change> <Q-id> <text>` answers one;
   `status` prints each waiting run's questions with that command. An
   answer is written to `decisions.md` in the run's own working directory;
   the waiting run reads it there, so the file is the channel between
   hosts and across restarts, not the run's message channel.
8. **The supervisor.** A run waiting on a question is "waiting on a person"
   (ADR 0039) and is pointed out after `waitingAfterSeconds`, with the
   `answer` command beside `status`; under `act`, a waiting run is never
   repeated or moved, and no stop is offered for it.

## Risks / Trade-offs

- **A run waits as long as nobody answers**, holding its process. The wait
  is visible everywhere, the supervisor points it out, and a cancel ends
  it; the question stays open in `decisions.md`.
- **Two hosts answer at once.** The first answer recorded wins; the second
  is refused as answered, and said so.
- **An agent asks what the files already decide.** The operator answers
  with a pointer; the instruction tells the agent to ask only what the
  files do not decide.
