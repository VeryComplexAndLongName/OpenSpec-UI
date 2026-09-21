import { mkdtemp, readdir, rm, stat, utimes, writeFile, mkdir } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";

// The runner builds an agent's context before it runs, which for some kinds
// asks the openspec CLI; a runner absent from a CI machine
// (ci-lacks-the-global-clis-this-machine-has).
vi.mock("./openspec.js", () => ({ instructionsForArtifact: async () => undefined }));

import { type AgentAdapter, createAgentRunner } from "./agent-runner.js";
import type { Command, Event } from "./protocol.js";
import {
  RUN_LOG_DIRECTORY,
  createFileRunLogs,
  isRunLogId,
  listRunLogs,
  readRunLog,
  runLogLineOf,
  type RunLogLine,
} from "./run-log.js";
import { type AllowlistConfig, InMemoryAuditLog } from "./security.js";

// a-change-shows-its-run-logs. Real files in a temporary workspace: what is
// asserted is what a person opening a run's log afterwards reads.
//
// every-varying-check-has-a-budget: temporary files only, no process.
// Measured 2026-09-21 at under 1 s for the file on this machine.
vi.setConfig({ testTimeout: 15_000 });

const roots: string[] = [];

afterEach(async () => {
  await Promise.all(roots.splice(0).map((root) => rm(root, { recursive: true, force: true })));
});

async function workspace(): Promise<string> {
  const root = await mkdtemp(path.join(os.tmpdir(), "openspec-run-log-"));
  roots.push(root);
  return root;
}

function event(kind: string, fields: Record<string, unknown>): Event {
  return { kind, runId: "r1", timestamp: "2026-09-21T10:00:01.000Z", ...fields } as Event;
}

function lines(records: Awaited<ReturnType<typeof readRunLog>>): Array<Pick<RunLogLine, "stream" | "text">> {
  return (records ?? [])
    .filter((record): record is RunLogLine => record.type === "line")
    .map(({ stream, text }) => ({ stream, text }));
}

describe("a run's log", () => {
  it("keeps what the run said, and how it ended", async () => {
    const root = await workspace();
    const log = createFileRunLogs(root).open({ runId: "r1", agent: "claude-cli", kind: "implement", cwd: root, changeName: "demo" });

    log.event(event("stdout", { chunk: "building" }));
    log.event(event("stderr", { chunk: "a warning" }));
    log.event(event("agentUpdate", { update: { sessionUpdate: "agent_message_chunk", content: { type: "text", text: "Done with 2.3." } } }));
    log.event(event("usageReported", { usage: {} }));
    await log.end({ outcome: "completed", summary: "two tasks" });

    const records = await readRunLog(root, "r1");
    expect(records?.[0]).toMatchObject({ type: "start", runId: "r1", agent: "claude-cli", kind: "implement", changeName: "demo" });
    expect(lines(records)).toEqual([
      { stream: "stdout", text: "building" },
      { stream: "stderr", text: "a warning" },
      { stream: "reply", text: "Done with 2.3." },
    ]);
    expect(records?.at(-1)).toMatchObject({ type: "end", outcome: "completed", summary: "two tasks" });
  });

  it("keeps a chain's stages in one file, each with its own start and end", async () => {
    const root = await workspace();
    const logs = createFileRunLogs(root);

    const first = logs.open({ runId: "chain1", agent: "claude-cli", kind: "chain", cwd: root, changeName: "demo", stage: "propose" });
    first.event(event("stdout", { chunk: "proposing" }));
    await first.end({ outcome: "completed" });
    const second = logs.open({ runId: "chain1", agent: "copilot-cli", kind: "chain", cwd: root, changeName: "demo", stage: "apply" });
    second.event(event("stdout", { chunk: "applying" }));
    await second.end({ outcome: "failed", reason: "tests failed" });

    const records = await readRunLog(root, "chain1");
    expect(records?.map((record) => record.type)).toEqual(["start", "line", "end", "start", "line", "end"]);
    const [summary] = await listRunLogs(root);
    expect(summary).toMatchObject({ runId: "chain1", stages: ["propose", "apply"], outcome: "failed", reason: "tests failed" });
  });

  it("stops at its size cap, says so, and still says how the run ended", async () => {
    const root = await workspace();
    const log = createFileRunLogs(root, { maxBytes: 1024 }).open({ runId: "big", agent: "claude-cli", kind: "implement", cwd: root });

    for (let index = 0; index < 100; index += 1) log.event(event("stdout", { chunk: `line ${index} `.repeat(4) }));
    await log.end({ outcome: "completed" });

    const records = await readRunLog(root, "big");
    const notes = lines(records).filter((line) => line.stream === "note");
    expect(notes).toHaveLength(1);
    expect(notes[0]?.text).toContain("The log stops here");
    expect(records?.at(-1)).toMatchObject({ type: "end", outcome: "completed" });
    expect((await stat(path.join(root, RUN_LOG_DIRECTORY, "big.jsonl"))).size).toBeLessThan(1024 + 512);
  });

  it("keeps only the newest logs", async () => {
    const root = await workspace();
    const directory = path.join(root, RUN_LOG_DIRECTORY);
    await mkdir(directory, { recursive: true });
    for (let index = 0; index < 4; index += 1) {
      const file = path.join(directory, `old${index}.jsonl`);
      await writeFile(file, "", "utf8");
      const when = new Date(Date.UTC(2026, 0, 1 + index));
      await utimes(file, when, when);
    }

    await createFileRunLogs(root, { keep: 3 }).open({ runId: "new", agent: "claude-cli", kind: "review", cwd: root }).end({ outcome: "completed" });

    expect((await readdir(directory)).sort()).toEqual(["new.jsonl", "old2.jsonl", "old3.jsonl"]);
  });

  it("lists one change's runs, newest first, and none of another's", async () => {
    const root = await workspace();
    const logs = createFileRunLogs(root);
    await logs.open({ runId: "a", agent: "claude-cli", kind: "plan", cwd: root, changeName: "demo" }).end({ outcome: "completed" });
    await new Promise((resolve) => setTimeout(resolve, 5));
    await logs.open({ runId: "b", agent: "claude-cli", kind: "implement", cwd: root, changeName: "demo" }).end({ outcome: "cancelled" });
    await logs.open({ runId: "c", agent: "claude-cli", kind: "plan", cwd: root, changeName: "other" }).end({ outcome: "completed" });

    const listed = await listRunLogs(root, { changeName: "demo" });

    expect(listed.map((summary) => [summary.runId, summary.outcome])).toEqual([["b", "cancelled"], ["a", "completed"]]);
  });

  it("names nothing outside its directory", async () => {
    const root = await workspace();

    expect(isRunLogId("../secrets")).toBe(false);
    expect(isRunLogId("a/b")).toBe(false);
    expect(isRunLogId("..")).toBe(false);
    expect(isRunLogId("3f2c9a1e-7b1d-4c55-9a5e-0d1f2e3a4b5c")).toBe(true);
    expect(await readRunLog(root, "../audit")).toBeUndefined();
    expect(await listRunLogs(root)).toEqual([]);
  });

  it("reads a tool call as the line every surface shows, and skips what says nothing", () => {
    expect(runLogLineOf(event("agentUpdate", { update: { sessionUpdate: "agent_thought_chunk", content: { type: "text", text: "Hmm." } } })))
      .toEqual({ stream: "reasoning", text: "Hmm." });
    expect(runLogLineOf(event("usageReported", { usage: {} }))).toBeUndefined();
    expect(runLogLineOf(event("stageStarted", { stage: "apply", agentId: "claude-cli" })))
      .toEqual({ stream: "stage", text: "stage apply started (claude-cli)" });
  });
});

describe("the runner writes the log", () => {
  const allowlist: AllowlistConfig = {
    "fake-agent": [{ executable: "fake-cli", argsAllowed: (args) => args[0] === "-p" }],
  };

  function runnerIn(root: string, events: (command: Command) => AsyncGenerator<Event>, args = ["-p"]) {
    const adapter: AgentAdapter = {
      name: "fake-agent",
      buildInvocation: () => ({ kind: "process", executable: "fake-cli", args }),
      execute: (_invocation, command) => events(command),
    };
    return createAgentRunner(adapter, { workspaceRoot: root, allowlist, auditLog: new InMemoryAuditLog(), runLogs: createFileRunLogs(root) });
  }

  async function drain(iterable: AsyncIterable<Event>): Promise<void> {
    for await (const _event of iterable) { /* read to the end */ }
  }

  async function settled(root: string, runId: string) {
    // The runner does not wait for the log: a run's end is not held up by
    // a file. Asked until it is there.
    for (let attempt = 0; attempt < 50; attempt += 1) {
      const records = await readRunLog(root, runId);
      if (records?.at(-1)?.type === "end") return records;
      await new Promise((resolve) => setTimeout(resolve, 20));
    }
    return readRunLog(root, runId);
  }

  it("for a run that ran", async () => {
    const root = await workspace();
    const runner = runnerIn(root, async function* (command) {
      yield { kind: "stdout", runId: command.runId, timestamp: "2026-09-21T10:00:00.000Z", chunk: "hello" };
      yield { kind: "completed", runId: command.runId, timestamp: "2026-09-21T10:00:01.000Z", summary: "ok" };
    });

    await drain(runner.run({ kind: "review", cwd: root, runId: "run-ok", context: { changeDir: path.join(root, "openspec", "changes", "demo") } }));

    const records = await settled(root, "run-ok");
    expect(records?.[0]).toMatchObject({ type: "start", agent: "fake-agent", kind: "review", changeName: "demo" });
    expect(lines(records)).toEqual([{ stream: "stdout", text: "hello" }]);
    expect(records?.at(-1)).toMatchObject({ type: "end", outcome: "completed", summary: "ok" });
  });

  it("for a run the allowlist refused, saying why", async () => {
    const root = await workspace();
    const runner = runnerIn(root, async function* () { /* never reached */ }, ["--dangerous"]);

    await drain(runner.run({ kind: "review", cwd: root, runId: "run-refused", context: { changeDir: path.join(root, "openspec", "changes", "demo") } }));

    const records = await settled(root, "run-refused");
    expect(records?.at(-1)).toMatchObject({ type: "end", outcome: "blocked" });
  });
});
