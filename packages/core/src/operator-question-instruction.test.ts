import { mkdtemp, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";
import { AgentStatusWriter, readAgentStatuses, reportEventsToAgentStatus } from "./agent-status.js";
import { commandInstruction } from "./agents/shared.js";
import { readOperatorQuestion } from "./operator-question.js";
import type { Event } from "./protocol.js";

// every-varying-check-has-a-budget: a few small file writes.
vi.setConfig({ testTimeout: 15_000 });

const roots: string[] = [];
afterEach(async () => {
  await Promise.all(roots.splice(0).map((root) => rm(root, { recursive: true, force: true })));
});

// the-agent-asks-the-operator 1.1.
describe("the question instruction", () => {
  it("is on every agent stage, and tells the marker this product reads", () => {
    for (const kind of ["plan", "implement", "review", "update", "verify"] as const) {
      const instruction = commandInstruction(kind);
      expect(instruction).toContain("Question for the operator: <the question>");
      expect(readOperatorQuestion("Question for the operator: <the question>")).toBe("<the question>");
    }
    expect(commandInstruction("status")).not.toContain("Question for the operator");
    expect(() => commandInstruction("answerQuestion")).toThrow("is not a single-agent command kind");
  });
});

// the-agent-asks-the-operator 1.3.
describe("a run waiting for the operator's answer", () => {
  it("says so in its status record, and a question asked while it works does not", async () => {
    const root = await mkdtemp(path.join(os.tmpdir(), "openspec-status-question-"));
    roots.push(root);
    const directory = path.join(root, "status");
    const writer = new AgentStatusWriter({ directory, workingDirectory: root, changeName: "demo" });
    await writer.start();
    const waiting: unknown[] = [];
    const events: Event[] = [
      { kind: "question", runId: "run-1", timestamp: "t", questionId: "Q-run1-1", text: "Which database?" },
      { kind: "awaitingAnswers", runId: "run-1", timestamp: "t", questions: [{ questionId: "Q-run1-1", text: "Which database?" }] },
    ];
    async function* stream() { yield* events; }
    for await (const _event of reportEventsToAgentStatus(stream(), writer)) {
      waiting.push((await readAgentStatuses(directory)).reports[0]?.waiting ?? null);
    }
    await writer.stop();

    expect(waiting).toEqual([null, { kind: "question", questions: [{ questionId: "Q-run1-1", text: "Which database?" }] }]);
  });
});
