## Context

`agent-messages.ts` writes and reads exactly one kind of message. Its
reading is addressed (`to` is a run's instance id), sealed
(`sealEnvelope`), and refused three ways: `unverified`, `stale`, `seen`.
`AgentStatusWriter` reads the directory at every renewal - about every five
seconds - and hands what it finds to the handlers its host passed.

`HarnessChainRunner` builds each stage's `Command` with a `CommandContext`,
and the verify stage already adds a section to `promptContext`. That is the
only way words reach an agent: an agent reads its prompt when its stage
starts.

## Goals / Non-Goals

**Goals:**

- Say something to a run, with or without expecting an answer.
- Have the answer come back to the person who asked.
- Keep every rule the stop message established: signed, addressed,
  refusable, recorded.

**Non-Goals:**

- Reaching an agent mid-stage.
- A chat window. This is a message left for a run and a reply left for a
  person, not a session.

## Decisions

### The kinds are `note`, `ask` and `answer`, beside `stop`

`stop` stays what it is. `note` and `ask` differ in one thing: whether the
run owes a reply. They are not one kind with a flag, because a reader of an
audit entry should not have to read a boolean to know whether somebody is
waiting.

### Freshness is per kind

A `stop` goes stale in a minute, and must: a request to stop, kept for
later, is not the request a person made. A note is the opposite - it is
written precisely because the run is busy - so `note`, `ask` and `answer`
stay fresh for a day, and are removed once delivered or read rather than by
the clock.

**Rejected: no expiry at all.** A directory nothing ever removes becomes a
directory nobody reads.

### `author` says what kind of sender, the roster says who

The payload carries `author: "person" | "run"`. It is a claim, like
`machine` and `gitAuthor` beside it, and the signature and the roster are
what establish identity. It exists so a receiver can refuse every
run-authored message without opening the words, which is what
`allowAgentMessages` does.

**Rejected: deciding "is this a run" from the key.** A person and their
run sign with the same machine key by design (ADR 0028, one key per person
per machine). The key cannot tell them apart, and inventing a second key
for runs would be a new trust boundary for one boolean.

### A run does not take another run's messages unless told to

`allowAgentMessages` in the harness configuration, absent meaning `false`.
The owner asked whether agents can talk to each other; they can see each
other in the roster, so they can. That is exactly why it is off: a run
that takes instructions from another run has a second operator nobody
chose, and the refusal is recorded like any other.

### Words reach the agent through the next stage's prompt

A delivered message becomes a section of the next stage's `promptContext`,
the way the verify stage's established-checks section already does. It says
who said it and when, and it is marked as what it is: words from the
operator, not content read out of the repository.

This is late by design: a note left while `apply` is running reaches the
agent when the next stage starts. Saying so is better than a mechanism
that pretends otherwise, and a person who needs the run to act now has
`stop` and `stop after <task>`.

### An `ask` is answered when the stage that received it ends

The run writes an `answer` addressed to the asker, carrying what the agent
said in that stage. There is no separate question to the agent and no
second turn: the ask is in the prompt, and the stage's own words are the
reply.

**Rejected: a stage of its own for answering.** A question would then cost
a model call and a budget line of its own, and the answer would be written
by an agent that had not done the work.

## Risks / Trade-offs

- **An answer is as good as what the agent said.** Where a stage says
  little, the answer says little. It carries the stage and the run so the
  person can go and look.
- **A message delivered late can be irrelevant.** It carries the time it
  was sent, and the agent is told when it was said.
- **The directory grows.** Delivered and answered messages are removed;
  the day-old sweep catches what nobody came back for.
