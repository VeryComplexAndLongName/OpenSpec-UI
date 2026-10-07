# 0042: The Agent Asks the Operator, and Nothing Goes On Without an Answer

Status: Proposed

Date: 2026-10-07

## Context

A tester on 2026-10-07: "Running propose again ... visualises that the
operator (me) must decide on four questions. Normally, I would write these
into the chat window - but how is that conceived to work here?" It is not.

The product can already stop and wait for a person in two places: a
checkpoint between stages under `semi-autonomous`, and an ACP agent's
permission request. Both block until answered, are written to the run's
status record as `waiting`, and are pointed out by the supervisor when they
wait long (ADR 0039). It can hear an agent through a marker line, `Starting
task <n>` (ADR 0029). It can carry the operator's words to an agent at the
start of a stage (the-operator-can-say-something-to-a-run).

What it cannot do is notice that an agent needs a decision. The questions
live in the prose of a reply, the run completes, and a chain goes on to the
next stage with them unanswered. An external CLI agent cannot be paused in
the middle of its turn for a typed answer: Claude CLI runs non-interactive,
and ACP has a permission request but no question. The product's own agent,
`local-llm-acp` (ADR 0038), runs in process, and can.

The owner decided on 2026-10-07: the answers are kept in the change's
`decisions.md` and in the audit log; any run, in a chain or by itself, that
raises a question stops and waits for the answer; and the in-turn question
for `local-llm-acp` is built now, not later.

## Decision

1. **An agent asks with a marker.** Every agent stage's instruction says:
   for each decision you need from the operator, print a line of its own,
   `Question for the operator: <the question>`, and do not decide it
   yourself. The product reads such lines from what the run says, as it
   reads `Starting task` (ADR 0029). Prose is not read: no marker, no
   question.
2. **`local-llm-acp` asks in its turn.** It gets a tool, `ask_operator`,
   whose call emits the same question and blocks the agent loop until the
   answer arrives, which is then its result. Under every autonomy level.
3. **A question is an event, an answer a command.** A non-terminal event
   `question` (question id, text, stage) and a command `answerQuestion`
   (question id, answer, who), as `permissionRequest` and
   `resolvePermission` are. The run's status record says `waiting` with a
   kind `question`, so the card, `status` and the supervisor see it.
4. **A run that asked stops and waits.** A run whose turn ended with
   unanswered questions does not complete and a chain does not start its
   next stage: the run waits, as at a checkpoint, under every autonomy
   level, for a single run as for a chain. When every question is answered,
   the stage runs again with the questions and answers in its prompt -
   `update` for `propose` and `review` (ADR 0041), the same command for
   `apply` and `verify` - and the chain goes on from there. A cancel ends
   the wait as it ends any.
5. **`decisions.md` holds them; nothing starts past them.** Each question
   is written to `openspec/changes/<change>/decisions.md` when it is asked,
   with its stage, run, time and `Answer: (open)`, and its answer, who gave
   it and when, when it is answered; the audit log records both. The file
   is the source of truth across restarts: an agent run on a change whose
   `decisions.md` holds an open question is refused, naming the question,
   until it is answered. Read-only commands are not refused.
6. **Answered from every surface.** The card's "Waiting on you" and the AI
   panel show each open question with a field for its answer; the
   Human-Only Inbox lists them; `openspec-ui-cli answer <change>
   <question-id> <text>` answers from a terminal. An answer reaches a run
   that waits in another host through the run's message channel
   (ADR 0028), and is in `decisions.md` regardless.

## Consequences

- Work stops where it needs a person, and says so where people look.
- A change carries its decisions in a file that is reviewed with it.
- The protocol gains an event, a command and a waiting kind.
- An agent that ignores the instruction decides alone, as today; the
  marker makes the difference visible, not impossible.

## Alternatives considered

- **Read questions out of prose.** Rejected: "Whether to keep the target
  filter" is a question to a reader and a statement to a parser.
- **Only show the questions, and let work go on.** Rejected by the owner:
  nothing goes on without an answer.
- **Answers in the audit log only.** Rejected by the owner: decisions are
  part of the change, reviewed with it.
