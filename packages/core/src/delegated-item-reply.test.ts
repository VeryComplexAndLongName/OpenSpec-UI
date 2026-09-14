import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";
import { createAgentRunner, type AgentAdapter, type AgentRunner } from "./agent-runner.js";
import { isRunEntry } from "./audit-runs.js";
import { buildDelegatedItemPrompt, runDelegatedItem } from "./delegated-item-run.js";
import type { Command, Event } from "./protocol.js";
import { InMemoryAuditLog, type AllowlistConfig } from "./security.js";

// a-change-says-where-it-stands 8.5. Touches the filesystem, a workspace of
// one small change, with a fake adapter: no agent, no git repository. The
// ceiling is the one delegated-item-run.test.ts uses for the same work.
vi.setConfig({ testTimeout: 20_000 });

const roots: string[] = [];

afterEach(async () => {
  await Promise.all(roots.splice(0).map((root) => rm(root, { recursive: true, force: true })));
});

const allowlist: AllowlistConfig = {
  "copilot-cli": [{ executable: "copilot", argsAllowed: (args) => args[0] === "-p" }],
};

async function workspace(tasks: string): Promise<{ root: string; tasksPath: string }> {
  const root = await mkdtemp(path.join(os.tmpdir(), "openspec-delegated-reply-"));
  roots.push(root);
  await mkdir(path.join(root, "openspec", "specs"), { recursive: true });
  await writeFile(path.join(root, "openspec", "config.yaml"), "schema: spec-driven\n", "utf8");
  const dir = path.join(root, "openspec", "changes", "demo");
  await mkdir(dir, { recursive: true });
  await writeFile(path.join(dir, "proposal.md"), "## Why\n\nBecause.\n", "utf8");
  const tasksPath = path.join(dir, "tasks.md");
  await writeFile(tasksPath, tasks, "utf8");
  return { root, tasksPath };
}

/** A runner whose agent says `said` on stdout, after doing `act`. */
function sayingRunner(auditLog: InMemoryAuditLog, root: string, said: string, act?: () => Promise<void>): AgentRunner {
  const adapter: AgentAdapter = {
    name: "copilot-cli",
    buildInvocation: () => ({ kind: "process", executable: "copilot", args: ["-p"] }),
    async *execute(_invocation, command: Command): AsyncGenerator<Event> {
      await act?.();
      yield { kind: "stdout", runId: command.runId, timestamp: "t", chunk: said };
      yield { kind: "completed", runId: command.runId, timestamp: "t", summary: "done" };
    },
  };
  return createAgentRunner(adapter, { workspaceRoot: root, allowlist, auditLog });
}

describe("runDelegatedItem — a request and its reply", () => {
  it("records the request, then a reply carrying the agent's last words, for a run that leaves its item open", async () => {
    const { root } = await workspace("- [ ] 2.1 **Delegated to copilot-cli**: check the server\n");
    const auditLog = new InMemoryAuditLog();

    const result = await runDelegatedItem({
      workspaceRoot: root,
      changeName: "demo",
      lineNumber: 0,
      runId: "run-1",
      from: "ada@example.com",
      auditLog,
      resolveRunner: () => sayingRunner(auditLog, root, "I could not reach the server, so 2.1 stays open.\n"),
    });

    const messages = auditLog.entries.filter((entry) => entry.outcome === "message");
    expect(messages).toHaveLength(2);
    const [request, reply] = messages;
    expect(request).toMatchObject({ runId: "run-1", taskNumber: "2.1", agent: "copilot-cli" });
    expect(request?.message).toMatchObject({
      kind: "request",
      from: { person: "ada@example.com" },
      to: { agent: "copilot-cli" },
      body: expect.stringContaining("check the server"),
    });
    expect(reply?.message).toMatchObject({
      kind: "reply",
      inReplyTo: request?.message?.id,
      from: { agent: "copilot-cli" },
      to: { person: "ada@example.com" },
      outcome: "left-open",
      body: "I could not reach the server, so 2.1 stays open.",
    });
    expect(result.status === "ran" && result.reply).toMatchObject({ outcome: "left-open", body: "I could not reach the server, so 2.1 stays open." });
    // A message is not a run: the counters that pair runs skip it.
    expect(messages.every((entry) => !isRunEntry(entry))).toBe(true);
  });

  it("records a closed reply for a run that ticks its item with evidence", async () => {
    const { root, tasksPath } = await workspace("- [ ] 2.1 **Delegated to copilot-cli**: check the server\n");
    const auditLog = new InMemoryAuditLog();

    await runDelegatedItem({
      workspaceRoot: root,
      changeName: "demo",
      lineNumber: 0,
      from: "ada@example.com",
      auditLog,
      resolveRunner: () => sayingRunner(auditLog, root, "Ticked 2.1 with the response code.", async () => {
        await writeFile(tasksPath, "- [x] 2.1 **Delegated to copilot-cli**: check the server\n  Done: it answered 200.\n", "utf8");
      }),
    });

    const reply = auditLog.entries.filter((entry) => entry.outcome === "message").at(-1);
    expect(reply?.message).toMatchObject({ kind: "reply", outcome: "closed", body: "Ticked 2.1 with the response code." });
  });
});

describe("buildDelegatedItemPrompt — how to answer", () => {
  it("asks the agent to answer within its turn and to leave nothing in the background", () => {
    const prompt = buildDelegatedItemPrompt({ changeName: "demo", taskNumber: "2.1", text: "2.1 **Delegated to copilot-cli**: check it" });

    expect(prompt).toContain("## How to answer");
    expect(prompt).toContain("Wait for every command you start, in this turn.");
    expect(prompt).toContain("Do not leave anything");
    expect(prompt).toContain("End your turn with what you did and, if the task is not closed, why.");
  });
});
