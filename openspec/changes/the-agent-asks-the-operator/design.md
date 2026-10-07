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
   (run id and a counter), `text`, `stage`, `changeDir`, `askedAt`.
   `answerQuestion`: `questionId`, `answer`, `by`. The runner emits
   `question` as soon as it reads the marker, so the card shows it while
   the agent still works; the status record's `waiting` becomes
   `{ kind: "question", questions: [...] }` when the turn ends.
3. **Waiting instead of completing.** `agent-runner.ts` holds the agent's
   own `completed` while any question of the run is open, as the chain
   holds a `failed` under `act` (the-supervisor-changes-agents): it emits
   `progress` "waiting for the operator's answer to N question(s)", writes
   `waiting`, and blocks on the answers. When the last one arrives, it runs
   the stage again in the same run - `update` for `plan` and `review`, the
   same command otherwise - with a prompt section "The operator's answers"
   holding each question and answer, and its outcome is the run's. A chain
   runs its stages through this runner and so waits in the stage; its
   checkpoint logic is untouched. The terminal-event contract (ADR 0012)
   holds: one terminal event, last.
4. **`ask_operator`.** A tool of `local-llm-acp` with one argument,
   `question`. Its execution emits `question` through the same path and
   awaits `answerQuestion` for that id; the answer is the tool's result,
   and the turn goes on. It is not offered under `local-llm` (text only).
5. **`decisions.md`.** `decisions-file.ts` appends, never rewrites another
   entry:

   ```
   ## Q-<run>-<n>: <question>

   - Asked: <time> by <agent>, stage <stage>, run <run id>
   - Answer: (open)
   ```

   and on answer replaces that entry's `Answer:` line with the answer,
   followed by `- Answered: <time> by <who>`. Written in the change's own
   worktree. The audit log records `message` entries with `question` and
   `answer` fields. `openQuestions(changeDir)` reads the file.
6. **The refusal.** `agent-runner.ts` refuses an agent command (`plan`,
   `review`, `update`, `implement`, `verify`, `chain`) on a change whose
   `decisions.md` holds an open question that is not this run's own, with
   "<change> has an open question for the operator: <Q-id> <text>. Answer
   it first: <commands>". Read-only commands run.
7. **Surfaces.** The card's "Waiting on you" lists each open question with
   a field and **Answer**; the AI panel shows the questions of the run it
   watches the same way; the Human-Only Inbox lists open questions from
   `decisions.md` beside Human-only items and answers them the same way;
   `openspec-ui-cli answer <change> <Q-id> <text>` and `status` lists open
   questions. An answer given where the run is not is sent on the run's
   message channel; the waiting run takes it, as it takes a stop request.
8. **The supervisor.** A run waiting on a question is "waiting on a person"
   (ADR 0039) and is pointed out after `waitingAfterSeconds`; under `act`,
   a waiting run is never repeated or moved.

## Risks / Trade-offs

- **A run waits as long as nobody answers**, holding its process. The wait
  is visible everywhere, the supervisor points it out, and a cancel ends
  it; the question stays open in `decisions.md`.
- **Two hosts answer at once.** The first answer recorded wins; the second
  is refused as answered, and said so.
- **An agent asks what the files already decide.** The operator answers
  with a pointer; the instruction tells the agent to ask only what the
  files do not decide.
