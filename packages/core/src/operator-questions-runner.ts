// A run that asks the operator waits for the answer, and goes on with it
// (the-agent-asks-the-operator, ADR 0042).
//
// Wraps any runner, so every host and every chain stage behaves the same:
// the questions an agent asks with the `Question for the operator:` marker
// are written to the change's `decisions.md` and said as `question` events
// while the agent works; where any is open when its pass ends, the run's
// `completed` is held, the run waits until each is answered - from any host,
// the CLI, or the file itself - and then runs the stage again in the same
// run with the answers (`update` for a `plan` or a `review`, the same command
// otherwise). Its outcome is the run's: one terminal event, last (ADR 0012).
//
// A run is refused on a change with a question still open from another run:
// the decision is the operator's, and no work goes past it.

import {
  answerQuestion,
  appendQuestion,
  openQuestions,
  nextQuestionId,
  readQuestions,
} from "./decisions-file.js";
import path from "node:path";
import { readAcpStreamedText } from "./acp-streamed-text.js";
import { changeNameOf } from "./audit-runs.js";
import { changeOfWorktree } from "./change-worktrees.js";
import { createGitWrapper } from "./git.js";
import { LineCollector, readOperatorQuestion } from "./operator-question.js";
import type { AgentRunner } from "./agent-runner.js";
import type { Command, CommandKind, CompletedEvent, Event } from "./protocol.js";
import type { AuditLog } from "./security.js";

/** The agent stages: the commands that ask, and that a question stops. */
const ASKING_KINDS: ReadonlySet<CommandKind> = new Set<CommandKind>(["plan", "implement", "review", "update", "verify"]);

/** How often a waiting run reads `decisions.md` for an answer given
 * elsewhere: another host, the CLI, a person editing the file. */
export const ANSWER_POLL_INTERVAL_MS = 3_000;

export interface OperatorQuestionsOptions {
  /** Which agent the runner drives, for `decisions.md` and the audit log. */
  agent: string;
  auditLog?: AuditLog;
  /** Who answers from this host: its configured git identity. A test seam. */
  readIdentity?: (cwd: string) => Promise<string | undefined>;
  pollIntervalMs?: number;
  now?: () => Date;
  /** The change directories of the change's own worktrees, where a run of
   * it asks its questions. A test seam: production reads `git worktree
   * list` from the command's directory. */
  readChangeWorktreeDirs?: (cwd: string, changeName: string) => Promise<string[]>;
}

/** The change directory in each worktree that is the change's own, other
 * than the main one. A directory that is not a git repository has none. */
async function changeWorktreeDirsOf(cwd: string, changeName: string): Promise<string[]> {
  const worktrees = await createGitWrapper({ cwd }).worktreeList();
  return worktrees
    .filter((worktree, index) => changeOfWorktree(worktree, index === 0) === changeName)
    .map((worktree) => path.join(worktree.path, "openspec", "changes", changeName));
}

/** One spelling of a directory, for telling two of them apart. */
function samePlace(left: string): string {
  const resolved = path.resolve(left);
  return process.platform === "win32" ? resolved.toLowerCase() : resolved;
}

/** The command the stage goes on with once its questions are answered: a
 * plan or a review is revised with the answers, other work goes on. */
function goOnWith(kind: CommandKind): CommandKind {
  return kind === "plan" || kind === "review" ? "update" : kind;
}

/** What an event says in the agent's own words, where it says anything:
 * its output, or an ACP agent's reply - never its reasoning. */
function spokenText(event: Event): string | undefined {
  if (event.kind === "stdout") return event.chunk;
  if (event.kind === "agentUpdate") {
    const said = readAcpStreamedText(event.update);
    if (said?.kind === "agent_message_chunk") return said.text;
  }
  return undefined;
}

/** A run waiting for its answers. Registered before the run says it waits,
 * so a cancel that follows the word at once still finds it. */
interface Waiter {
  cancelled: boolean;
  wake?: () => void;
  cancel?: () => void;
}

export function withOperatorQuestions(runner: AgentRunner, options: OperatorQuestionsOptions): AgentRunner {
  const now = options.now ?? (() => new Date());
  const pollMs = options.pollIntervalMs ?? ANSWER_POLL_INTERVAL_MS;
  const readIdentity = options.readIdentity ?? ((cwd: string) => createGitWrapper({ cwd }).configuredIdentity());
  const readWorktreeDirs = options.readChangeWorktreeDirs ?? changeWorktreeDirsOf;

  /** Every question still open on the change, wherever its runs asked it:
   * the command's own directory, and the change's own worktree, so a run
   * started from the checkout does not go past a question its chain asked
   * in the worktree. The same question in both is counted once. */
  async function openQuestionsOfChange(command: Command): Promise<Awaited<ReturnType<typeof openQuestions>>> {
    const own = command.context.changeDir;
    const change = changeNameOf(own);
    const elsewhere = (await readWorktreeDirs(command.cwd, change).catch((): string[] => []))
      .filter((dir) => samePlace(dir) !== samePlace(own));
    const found = new Map<string, Awaited<ReturnType<typeof openQuestions>>[number]>();
    for (const dir of [own, ...elsewhere]) {
      for (const question of await openQuestions(dir).catch(() => [])) {
        if (!found.has(question.id)) found.set(question.id, question);
      }
    }
    return [...found.values()];
  }
  /** The runs waiting for answers, by run id. */
  const waiters = new Map<string, Waiter>();
  const at = () => now().toISOString();

  async function* answer(command: Command): AsyncGenerator<Event> {
    const id = command.questionId;
    const text = command.answer?.trim();
    if (id === undefined || text === undefined || text.length === 0) return;
    let by = "the operator";
    try {
      by = (await readIdentity(command.cwd)) ?? by;
    } catch {
      // An answer from somebody unnamed is still the answer.
    }
    const outcome = await answerQuestion(command.context.changeDir, id, { text, by, at: at() });
    if (outcome !== "answered") {
      // Not `failed`: this stream shares the waiting run's id, and a host
      // reading `failed` would take the run for ended.
      yield { kind: "progress", runId: command.runId, timestamp: at(), message: outcome === "already-answered" ? `${id} was already answered` : `${id} is not a question of this change` };
      return;
    }
    options.auditLog?.record({
      runId: command.runId,
      agent: options.agent,
      outcome: "message",
      cwd: command.cwd,
      timestamp: at(),
      changeDir: command.context.changeDir,
      operatorQuestion: { questionId: id, text: "", answer: text, by },
    });
    waiters.get(command.runId)?.wake?.();
    yield { kind: "questionAnswered", runId: command.runId, timestamp: at(), questionId: id, answer: text, by };
  }

  /** Waits until every one of `ids` is answered in `decisions.md`, or the
   * run is cancelled, and says each answer in the run's stream as it lands
   * rather than once all have: with two questions open, one answered on the
   * card stayed on the run panel until the other was answered too (live,
   * 2026-10-08). Returns whether the wait ended answered or cancelled. */
  async function* waitForAnswers(
    command: Command,
    ids: readonly string[],
    waiter: Waiter,
    announced: Set<string>,
  ): AsyncGenerator<Event, "answered" | "cancelled"> {
    try {
      for (;;) {
        if (waiter.cancelled) return "cancelled";
        const questions = await readQuestions(command.context.changeDir).catch(() => []);
        let open = 0;
        for (const id of ids) {
          const question = questions.find((entry) => entry.id === id);
          if (question?.answer === undefined) {
            open += 1;
            continue;
          }
          if (announced.has(id)) continue;
          announced.add(id);
          yield {
            kind: "questionAnswered",
            runId: command.runId,
            timestamp: at(),
            questionId: id,
            answer: question.answer,
            ...(question.answeredBy !== undefined ? { by: question.answeredBy } : {}),
          };
        }
        if (open === 0) return "answered";
        await new Promise<void>((resolve) => {
          const timer = setTimeout(resolve, pollMs);
          waiter.wake = () => { clearTimeout(timer); resolve(); };
          waiter.cancel = () => { clearTimeout(timer); resolve(); };
        });
      }
    } finally {
      waiters.delete(command.runId);
    }
  }

  async function* runAsking(command: Command): AsyncGenerator<Event> {
    const changeDir = command.context.changeDir;
    let pass = command;
    let first = true;
    const answers: Array<{ question: string; answer: string }> = [];
    /** The questions of this run already said to be answered in its stream. */
    const announced = new Set<string>();
    for (;;) {
      const thisPass: Array<{ questionId: string; text: string }> = [];
      const seen = new Set<string>();
      const lines = new LineCollector();
      let held: CompletedEvent | undefined;

      async function* readLines(found: string[]): AsyncGenerator<Event> {
        for (const line of found) {
          const text = readOperatorQuestion(line);
          if (text === undefined || seen.has(text)) continue;
          seen.add(text);
          const id = await nextQuestionId(changeDir, command.runId);
          await appendQuestion(changeDir, {
            id,
            text,
            askedAt: at(),
            agent: options.agent,
            stage: command.stage ?? command.kind,
            runId: command.runId,
          });
          options.auditLog?.record({
            runId: command.runId,
            agent: options.agent,
            outcome: "message",
            cwd: command.cwd,
            timestamp: at(),
            changeDir,
            operatorQuestion: { questionId: id, text },
          });
          thisPass.push({ questionId: id, text });
          yield { kind: "question", runId: command.runId, timestamp: at(), questionId: id, text };
        }
      }

      /** Says in this run's own stream that a question it asked has been
       * answered, wherever the answer was given - this run's panel, a card,
       * the CLI, the file - so whoever watches the run stops offering a
       * field for it. A question the agent waits on in its turn
       * (`ask_operator`) is answered while the pass goes on, and nothing
       * else in the stream would say so (live, 2026-10-08). */
      async function* announceAnswered(): AsyncGenerator<Event> {
        const pending = thisPass.filter((question) => !announced.has(question.questionId));
        if (pending.length === 0) return;
        const recorded = await readQuestions(changeDir).catch(() => []);
        for (const question of pending) {
          const entry = recorded.find((each) => each.id === question.questionId);
          if (entry?.answer === undefined) continue;
          announced.add(question.questionId);
          yield {
            kind: "questionAnswered",
            runId: command.runId,
            timestamp: at(),
            questionId: question.questionId,
            answer: entry.answer,
            ...(entry.answeredBy !== undefined ? { by: entry.answeredBy } : {}),
          };
        }
      }

      const events = runner.run(pass)[Symbol.asyncIterator]();
      let finished = false;
      try {
        for (;;) {
          // While a question of this pass is unanswered, the file is read
          // between the agent's events, and every `pollMs` when it says
          // nothing - an agent waiting on `ask_operator` says nothing.
          const next = events.next();
          let result: IteratorResult<Event>;
          for (;;) {
            if (!thisPass.some((question) => !announced.has(question.questionId))) {
              result = await next;
              break;
            }
            let timer: ReturnType<typeof setTimeout> | undefined;
            const raced = await Promise.race([
              next,
              new Promise<"tick">((resolve) => { timer = setTimeout(() => resolve("tick"), pollMs); }),
            ]);
            clearTimeout(timer);
            if (raced !== "tick") {
              result = raced;
              break;
            }
            yield* announceAnswered();
          }
          if (result.done) {
            finished = true;
            break;
          }
          const event = result.value;
          // One `started` per run: the pass that goes on is the same run.
          if (!first && event.kind === "started") continue;
          if (event.kind === "completed") {
            held = event;
            continue;
          }
          yield event;
          const spoken = spokenText(event);
          if (spoken !== undefined) yield* readLines(lines.take(spoken));
          yield* announceAnswered();
        }
      } finally {
        if (!finished) await events.return?.();
      }
      yield* readLines(lines.rest());
      yield* announceAnswered();

      // Failed or cancelled: that is the run's end, as it always was.
      if (held === undefined) return;
      // Only what is still open: a question answered while the agent worked
      // - the local agent's ask_operator waits for its answer in the turn -
      // has had its answer where it was asked (ADR 0042 decision 4).
      const recordedAtEnd = await readQuestions(changeDir).catch(() => []);
      const stillOpen = thisPass.filter((question) =>
        recordedAtEnd.find((entry) => entry.id === question.questionId)?.answer === undefined);
      if (stillOpen.length === 0) {
        yield held;
        return;
      }

      const waiter: Waiter = { cancelled: false };
      waiters.set(command.runId, waiter);
      yield {
        kind: "progress",
        runId: command.runId,
        timestamp: at(),
        message: `waiting for the operator's answer to ${stillOpen.length} question${stillOpen.length === 1 ? "" : "s"}`,
      };
      yield { kind: "awaitingAnswers", runId: command.runId, timestamp: at(), questions: stillOpen };
      const ids = stillOpen.map((question) => question.questionId);
      const waited = yield* waitForAnswers(command, ids, waiter, announced);
      if (waited === "cancelled") {
        yield { kind: "cancelled", runId: command.runId, timestamp: at(), reason: "cancelled while waiting for the operator's answer; the questions stay open in decisions.md" };
        return;
      }
      const recorded = await readQuestions(changeDir).catch(() => []);
      for (const id of ids) {
        const question = recorded.find((entry) => entry.id === id);
        if (question?.answer === undefined) continue;
        answers.push({ question: question.text, answer: question.answer });
        if (announced.has(id)) continue;
        announced.add(id);
        yield {
          kind: "questionAnswered",
          runId: command.runId,
          timestamp: at(),
          questionId: id,
          answer: question.answer,
          ...(question.answeredBy !== undefined ? { by: question.answeredBy } : {}),
        };
      }
      yield { kind: "progress", runId: command.runId, timestamp: at(), message: `answered; going on as ${goOnWith(command.kind)}` };
      pass = { ...command, kind: goOnWith(command.kind), context: { ...command.context, answers: [...answers] } };
      first = false;
    }
  }

  return {
    async *run(command: Command): AsyncIterable<Event> {
      if (command.kind === "answerQuestion") {
        yield* answer(command);
        return;
      }
      if (command.kind === "cancel") {
        const waiter = waiters.get(command.runId);
        if (waiter !== undefined) {
          // The agent's pass is over; the wait is what is cancelled.
          waiter.cancelled = true;
          waiter.cancel?.();
          yield { kind: "cancelling", runId: command.runId, timestamp: at(), attempted: "termination-requested" };
          return;
        }
        yield* runner.run(command);
        return;
      }
      if (!ASKING_KINDS.has(command.kind)) {
        yield* runner.run(command);
        return;
      }
      const blocking = (await openQuestionsOfChange(command))
        .filter((question) => question.runId !== command.runId);
      if (blocking.length > 0) {
        const [question] = blocking;
        const change = changeNameOf(command.context.changeDir);
        yield {
          kind: "failed",
          runId: command.runId,
          timestamp: at(),
          reason: `${change} has ${blocking.length === 1 ? "an open question" : `${blocking.length} open questions`} for the operator: `
            + `${question!.id} "${question!.text}". Answer ${blocking.length === 1 ? "it" : "them"} first - on the change's card, `
            + `with \`openspec-ui-cli answer question ${change} ${question!.id} "<answer>"\`, or in its decisions.md.`,
        };
        return;
      }
      yield* runAsking(command);
    },
  };
}
