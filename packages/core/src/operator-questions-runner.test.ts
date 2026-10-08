import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { AgentRunner } from "./agent-runner.js";
import { appendQuestion, openQuestions, questionId } from "./decisions-file.js";
import { withOperatorQuestions } from "./operator-questions-runner.js";
import type { Command, Event } from "./protocol.js";
import { InMemoryAuditLog } from "./security.js";

// every-varying-check-has-a-budget: the agent is a scripted generator and
// the file is a few lines; the waits are tens of milliseconds.
vi.setConfig({ testTimeout: 15_000 });

const roots: string[] = [];
afterEach(async () => {
  await Promise.all(roots.splice(0).map((root) => rm(root, { recursive: true, force: true })));
});

async function change(): Promise<string> {
  const root = await mkdtemp(path.join(os.tmpdir(), "openspec-asks-"));
  roots.push(root);
  return path.join(root, "openspec", "changes", "demo");
}

const at = "2026-10-07T20:00:00.000Z";

/** An agent whose first pass prints its reply, and whose later passes say
 * what they were given. */
function scriptedAgent(firstReply: string) {
  const commands: Command[] = [];
  const runner: AgentRunner = {
    async *run(command: Command) {
      commands.push(command);
      if (command.kind === "cancel") return;
      yield { kind: "started", runId: command.runId, timestamp: at, command: command.kind, cwd: command.cwd };
      if (commands.length === 1) {
        // Cut mid-line, as a stream is.
        yield { kind: "stdout", runId: command.runId, timestamp: at, chunk: firstReply.slice(0, 20) };
        yield { kind: "stdout", runId: command.runId, timestamp: at, chunk: firstReply.slice(20) };
      }
      yield { kind: "completed", runId: command.runId, timestamp: at, summary: `${command.kind} pass ${commands.length}` };
    },
  };
  return { runner, commands };
}

function command(changeDir: string, kind: Command["kind"] = "review", runId = "run-ask-1"): Command {
  return { kind, cwd: path.dirname(path.dirname(path.dirname(changeDir))), runId, context: { changeDir } };
}

async function drainUntil(events: AsyncIterator<Event>, seen: Event[], kind: Event["kind"]): Promise<void> {
  for (;;) {
    const next = await events.next();
    if (next.done) throw new Error(`the stream ended before ${kind}`);
    seen.push(next.value);
    if (next.value.kind === kind) return;
  }
}

async function drainAll(events: AsyncIterator<Event>, seen: Event[]): Promise<void> {
  for (;;) {
    const next = await events.next();
    if (next.done) return;
    seen.push(next.value);
  }
}

// the-agent-asks-the-operator 1.5.
describe("withOperatorQuestions", () => {
  it("passes a run that asks nothing through unchanged", async () => {
    const dir = await change();
    const { runner } = scriptedAgent("All good.\nReview verdict: ready\n");
    const wrapped = withOperatorQuestions(runner, { agent: "copilot-cli-acp" });

    const seen: Event[] = [];
    await drainAll(wrapped.run(command(dir))[Symbol.asyncIterator](), seen);

    expect(seen.map((event) => event.kind)).toEqual(["started", "stdout", "stdout", "completed"]);
    expect(await openQuestions(dir)).toEqual([]);
  });

  it("waits on a question instead of completing, and goes on as an update with the answer once answered here", async () => {
    const dir = await change();
    const { runner, commands } = scriptedAgent("Two things.\n- **Question for the operator:** Keep the v1 API? (yes/no)\nReview verdict: changes needed\n");
    const auditLog = new InMemoryAuditLog();
    const wrapped = withOperatorQuestions(runner, { agent: "copilot-cli-acp", auditLog, readIdentity: async () => "Ada", pollIntervalMs: 60_000 });

    const events = wrapped.run(command(dir))[Symbol.asyncIterator]();
    const seen: Event[] = [];
    await drainUntil(events, seen, "awaitingAnswers");

    expect(seen.filter((event) => event.kind === "completed")).toEqual([]);
    const question = seen.find((event) => event.kind === "question");
    expect(question).toMatchObject({ text: "Keep the v1 API? (yes/no)", questionId: questionId("run-ask-1", 1) });
    expect((await openQuestions(dir)).map((open) => open.text)).toEqual(["Keep the v1 API? (yes/no)"]);

    // Answered from this host, while the run waits.
    const rest = drainAll(events, seen);
    const answered: Event[] = [];
    for await (const event of wrapped.run({ ...command(dir, "answerQuestion"), questionId: questionId("run-ask-1", 1), answer: "Yes, keep it" })) answered.push(event);
    await rest;

    expect(answered).toEqual([expect.objectContaining({ kind: "questionAnswered", answer: "Yes, keep it", by: "Ada" })]);
    expect(commands.map((sent) => sent.kind)).toEqual(["review", "update"]);
    expect(commands[1]?.context.answers).toEqual([{ question: "Keep the v1 API? (yes/no)", answer: "Yes, keep it" }]);
    expect(seen.filter((event) => event.kind === "started")).toHaveLength(1);
    expect(seen.at(-1)).toMatchObject({ kind: "completed", summary: "update pass 2" });
    expect(await readFile(path.join(dir, "decisions.md"), "utf8")).toContain("- Answer: Yes, keep it");
    expect(auditLog.entries.filter((entry) => entry.outcome === "message").map((entry) => entry.operatorQuestion?.answer ?? "asked")).toEqual(["asked", "Yes, keep it"]);
  });

  it("takes an answer written into decisions.md elsewhere", async () => {
    const dir = await change();
    const { runner, commands } = scriptedAgent("Question for the operator: Which database?\n");
    const wrapped = withOperatorQuestions(runner, { agent: "local-llm-acp", pollIntervalMs: 20 });

    const events = wrapped.run(command(dir, "implement"))[Symbol.asyncIterator]();
    const seen: Event[] = [];
    await drainUntil(events, seen, "awaitingAnswers");
    const file = path.join(dir, "decisions.md");
    await writeFile(file, (await readFile(file, "utf8")).replace("- Answer: (open)", "- Answer: PostgreSQL"), "utf8");
    await drainAll(events, seen);

    expect(commands.map((sent) => sent.kind)).toEqual(["implement", "implement"]);
    expect(seen).toContainEqual(expect.objectContaining({ kind: "questionAnswered", answer: "PostgreSQL" }));
    expect(seen.at(-1)).toMatchObject({ kind: "completed" });
  });

  it("ends the wait on a cancel, leaving the question open", async () => {
    const dir = await change();
    const { runner } = scriptedAgent("Question for the operator: Which database?\n");
    const wrapped = withOperatorQuestions(runner, { agent: "copilot-cli-acp", pollIntervalMs: 60_000 });

    const events = wrapped.run(command(dir))[Symbol.asyncIterator]();
    const seen: Event[] = [];
    await drainUntil(events, seen, "awaitingAnswers");
    const cancelling: Event[] = [];
    for await (const event of wrapped.run({ ...command(dir, "cancel") })) cancelling.push(event);
    await drainAll(events, seen);

    expect(cancelling).toEqual([expect.objectContaining({ kind: "cancelling", attempted: "termination-requested" })]);
    expect(seen.at(-1)).toMatchObject({ kind: "cancelled" });
    expect(await openQuestions(dir)).toHaveLength(1);
  });

  it("refuses an agent run past another run's open question, and lets a read-only one run", async () => {
    const dir = await change();
    await appendQuestion(dir, { id: "Q-other-1", text: "Which database?", askedAt: at, agent: "claude-cli", stage: "review", runId: "run-other" });
    const { runner, commands } = scriptedAgent("Done.\n");
    const wrapped = withOperatorQuestions(runner, { agent: "copilot-cli-acp" });

    const refused: Event[] = [];
    for await (const event of wrapped.run(command(dir, "implement", "run-new"))) refused.push(event);
    expect(refused).toEqual([expect.objectContaining({ kind: "failed" })]);
    expect((refused[0] as Extract<Event, { kind: "failed" }>).reason).toContain('demo has an open question for the operator: Q-other-1 "Which database?"');
    expect(commands).toEqual([]);

    const read: Event[] = [];
    for await (const event of wrapped.run(command(dir, "status", "run-read"))) read.push(event);
    expect(read.at(-1)).toMatchObject({ kind: "completed" });
  });

  it("refuses a run from the checkout past a question its chain asked in the change's own worktree", async () => {
    const checkout = await change();
    const worktree = await change();
    await appendQuestion(worktree, { id: "Q-chain-1", text: "SQLite or PostgreSQL?", askedAt: at, agent: "copilot-cli-acp", stage: "review", runId: "run-chain" });
    const { runner, commands } = scriptedAgent("Done.\n");
    const asked: Array<[string, string]> = [];
    const wrapped = withOperatorQuestions(runner, {
      agent: "copilot-cli-acp",
      readChangeWorktreeDirs: async (cwd, changeName) => {
        asked.push([cwd, changeName]);
        return [worktree];
      },
    });

    const refused: Event[] = [];
    for await (const event of wrapped.run(command(checkout, "implement", "run-new"))) refused.push(event);

    expect(asked).toEqual([[path.dirname(path.dirname(path.dirname(checkout))), "demo"]]);
    expect((refused[0] as Extract<Event, { kind: "failed" }>).reason).toContain('demo has an open question for the operator: Q-chain-1 "SQLite or PostgreSQL?"');
    expect(commands).toEqual([]);
  });
});
