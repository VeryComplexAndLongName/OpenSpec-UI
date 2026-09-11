import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";

// Same reason agent-runner.test.ts mocks it: `prepareAgentContext`'s
// rules lookup for an `implement` command shells out to a real
// `openspec` binary, and these tests are about dispatch and the gate,
// not about the lookup. It stays best-effort undefined throughout.
vi.mock("./openspec.js", () => ({ instructionsForArtifact: async () => undefined }));

import { createAgentRunner, type AgentAdapter } from "./agent-runner.js";
import { buildDelegatedItemPrompt, runDelegatedItem } from "./delegated-item-run.js";
import type { AgentRunner } from "./agent-runner.js";
import type { Command, Event } from "./protocol.js";
import { InMemoryAuditLog, type AllowlistConfig } from "./security.js";

vi.setConfig({ testTimeout: 20_000 });

const roots: string[] = [];

afterEach(async () => {
  await Promise.all(roots.splice(0).map((root) => rm(root, { recursive: true, force: true })));
});

const allowlist: AllowlistConfig = {
  "copilot-cli": [{ executable: "copilot", argsAllowed: (args) => args[0] === "-p" }],
};

async function workspace(tasks: string, harness?: unknown): Promise<{ root: string; tasksPath: string }> {
  const root = await mkdtemp(path.join(os.tmpdir(), "openspec-delegated-run-"));
  roots.push(root);
  await mkdir(path.join(root, "openspec", "specs"), { recursive: true });
  await writeFile(path.join(root, "openspec", "config.yaml"), "schema: spec-driven\n", "utf8");
  const dir = path.join(root, "openspec", "changes", "demo");
  await mkdir(dir, { recursive: true });
  await writeFile(path.join(dir, "proposal.md"), "## Why\n\nBecause.\n", "utf8");
  const tasksPath = path.join(dir, "tasks.md");
  await writeFile(tasksPath, tasks, "utf8");
  if (harness !== undefined) {
    await writeFile(path.join(dir, "harness.json"), `${JSON.stringify(harness, null, 2)}\n`, "utf8");
  }
  return { root, tasksPath };
}

/** A runner built the way the hosts build theirs — `createAgentRunner`
 * over a fake adapter — so the allowlist, the cwd sandbox and the audit
 * entry under test are the real ones rather than a stand-in. */
function runnerOver(
  auditLog: InMemoryAuditLog,
  workspaceRoot: string,
  act: (command: Command) => Promise<void> | void,
  seen: { command?: Command; prompt?: string } = {},
): AgentRunner {
  const adapter: AgentAdapter = {
    name: "copilot-cli",
    buildInvocation: () => ({ kind: "process", executable: "copilot", args: ["-p"] }),
    async *execute(_invocation, command, prompt): AsyncGenerator<Event> {
      seen.command = command;
      seen.prompt = prompt;
      await act(command);
      yield { kind: "completed", runId: command.runId, timestamp: "t", summary: "done" };
    },
  };
  return createAgentRunner(adapter, { workspaceRoot, allowlist, auditLog });
}

describe("buildDelegatedItemPrompt", () => {
  it("states the change, the task verbatim, and the rule the task carries", () => {
    const prompt = buildDelegatedItemPrompt({
      changeName: "a-change",
      taskNumber: "6.6",
      text: "6.6 **Delegated to copilot-cli**: run it end to end. Evidence: the run id.",
    });

    expect(prompt).toContain('task 6.6 of the OpenSpec change "a-change"');
    expect(prompt).toContain("6.6 **Delegated to copilot-cli**: run it end to end. Evidence: the run id.");
    expect(prompt).toContain("Record the evidence this task names in the task's own text");
    expect(prompt).toContain("A tick with nothing written is reverted automatically");
  });
});

describe("runDelegatedItem — what reaches the agent and the log", () => {
  it("writes an audit entry naming the change and the task number", async () => {
    const { root } = await workspace("- [ ] 2.1 **Delegated to copilot-cli**: quote the audit line\n");
    const auditLog = new InMemoryAuditLog();
    const seen: { command?: Command; prompt?: string } = {};

    const result = await runDelegatedItem({
      workspaceRoot: root,
      changeName: "demo",
      lineNumber: 0,
      runId: "run-1",
      resolveRunner: () => runnerOver(auditLog, root, () => undefined, seen),
    });

    expect(result.status).toBe("ran");
    const started = auditLog.entries.find((entry) => entry.outcome === "started");
    expect(started?.agent).toBe("copilot-cli");
    expect(started?.taskNumber).toBe("2.1");
    expect(started?.changeDir).toContain(path.join("changes", "demo"));
    // The terminal entry carries it too — either can be the one a reader
    // finds first.
    expect(auditLog.entries.at(-1)?.taskNumber).toBe("2.1");
    // And the task's own text reached the agent as the prompt.
    expect(seen.prompt).toContain("quote the audit line");
  });

  it("passes the configured model and custom agent through to the command", async () => {
    const { root } = await workspace(
      "- [ ] 5.4 **Delegated to copilot-cli**: run it\n",
      { taskAgents: { "5.4": { agent: "copilot-cli", customAgent: "reviewer" } } },
    );
    const auditLog = new InMemoryAuditLog();
    const seen: { command?: Command; prompt?: string } = {};

    await runDelegatedItem({
      workspaceRoot: root,
      changeName: "demo",
      lineNumber: 0,
      resolveRunner: () => runnerOver(auditLog, root, () => undefined, seen),
    });

    expect(seen.command?.customAgent).toBe("reviewer");
    expect(seen.command?.agentId).toBe("copilot-cli");
    expect(seen.command?.taskNumber).toBe("5.4");
  });

  it("refuses an unregistered agent before anything is spawned, naming the id", async () => {
    const { root } = await workspace("- [ ] 1.1 **Delegated to copilto-cli**: a typo\n");
    let spawned = false;

    const result = await runDelegatedItem({
      workspaceRoot: root,
      changeName: "demo",
      lineNumber: 0,
      resolveRunner: () => {
        spawned = true;
        return undefined;
      },
    });

    expect(result.status).toBe("refused");
    expect(result.message).toContain('"copilto-cli" is not an agent this build recognises');
    // Not even a runner was asked for: the refusal happens first.
    expect(spawned).toBe(false);
  });

  it("refuses an item marked for a person", async () => {
    const { root } = await workspace("- [ ] 1.1 **Human-only**: judge whether it reads well\n");

    const result = await runDelegatedItem({
      workspaceRoot: root,
      changeName: "demo",
      lineNumber: 0,
      resolveRunner: () => {
        throw new Error("must not be reached");
      },
    });

    expect(result.status).toBe("refused");
    expect(result.message).toContain("marked for a person");
  });

  it("refuses an item that names nobody", async () => {
    const { root } = await workspace("- [ ] 1.1 Ordinary work\n");

    const result = await runDelegatedItem({
      workspaceRoot: root,
      changeName: "demo",
      lineNumber: 0,
      resolveRunner: () => undefined,
    });

    expect(result.status).toBe("refused");
    expect(result.message).toContain("names no agent");
  });
});

describe("runDelegatedItem — the rubber-stamp gate", () => {
  const TASKS = [
    "## 2. The work",
    "",
    "- [ ] 2.1 **Delegated to copilot-cli**: quote the audit line",
    "- [ ] 2.2 Another task nothing should touch",
    "",
  ].join("\n");

  /** Rewrites the item's line, and optionally adds a body under it —
   * what an agent editing tasks.md actually does. */
  function rewrite(tasksPath: string, line: string, body?: string) {
    return async () => {
      const lines = (await readFile(tasksPath, "utf8")).split("\n");
      lines[2] = line;
      if (body !== undefined) lines.splice(3, 0, body);
      await writeFile(tasksPath, lines.join("\n"), "utf8");
    };
  }

  it("reverts a tick that said nothing, and reports the refusal", async () => {
    const { root, tasksPath } = await workspace(TASKS);
    const auditLog = new InMemoryAuditLog();

    const result = await runDelegatedItem({
      workspaceRoot: root,
      changeName: "demo",
      lineNumber: 2,
      resolveRunner: () => runnerOver(
        auditLog,
        root,
        rewrite(tasksPath, "- [x] 2.1 **Delegated to copilot-cli**: quote the audit line"),
      ),
    });

    expect(result).toMatchObject({ status: "ran", gate: { kind: "reverted" } });
    expect(result.message).toContain("came back ticked with nothing written");
    // Asserted over the file, not over a value in memory: the tick is
    // only reverted if tasks.md itself came back unticked.
    const after = await readFile(tasksPath, "utf8");
    expect(after.split("\n")[2]).toBe("- [ ] 2.1 **Delegated to copilot-cli**: quote the audit line");
    expect(after.split("\n")[3]).toBe("- [ ] 2.2 Another task nothing should touch");
  });

  it("leaves a tick with new text exactly as the agent wrote it", async () => {
    const { root, tasksPath } = await workspace(TASKS);
    const auditLog = new InMemoryAuditLog();

    const result = await runDelegatedItem({
      workspaceRoot: root,
      changeName: "demo",
      lineNumber: 2,
      resolveRunner: () => runnerOver(
        auditLog,
        root,
        rewrite(
          tasksPath,
          "- [x] 2.1 **Delegated to copilot-cli**: quote the audit line",
          "  Run 2026-09-11, run id `run-7`: the entry carries `--agent reviewer`.",
        ),
      ),
    });

    expect(result).toMatchObject({ status: "ran", gate: { kind: "recorded" } });
    // And the surface says only that something was recorded.
    expect(result.message).toContain("Something was recorded; whether it is true was not checked.");
    const lines = (await readFile(tasksPath, "utf8")).split("\n");
    expect(lines[2]).toBe("- [x] 2.1 **Delegated to copilot-cli**: quote the audit line");
    expect(lines[3]).toBe("  Run 2026-09-11, run id `run-7`: the entry carries `--agent reviewer`.");
  });

  it("counts the indented body as the item's own text, not the next task's", async () => {
    // A run that wrote its evidence under the item and did not tick it
    // is still open, and nothing is reverted.
    const { root, tasksPath } = await workspace(TASKS);
    const auditLog = new InMemoryAuditLog();

    const result = await runDelegatedItem({
      workspaceRoot: root,
      changeName: "demo",
      lineNumber: 2,
      resolveRunner: () => runnerOver(
        auditLog,
        root,
        rewrite(
          tasksPath,
          "- [ ] 2.1 **Delegated to copilot-cli**: quote the audit line",
          "  Could not run: the binary is not installed here.",
        ),
      ),
    });

    expect(result).toMatchObject({ status: "ran", gate: { kind: "still-open" } });
    expect((await readFile(tasksPath, "utf8")).split("\n")[3])
      .toBe("  Could not run: the binary is not installed here.");
  });

  it("finds the item again when the run inserted lines above it", async () => {
    const { root, tasksPath } = await workspace(TASKS);
    const auditLog = new InMemoryAuditLog();

    const result = await runDelegatedItem({
      workspaceRoot: root,
      changeName: "demo",
      lineNumber: 2,
      resolveRunner: () => runnerOver(auditLog, root, async () => {
        const lines = (await readFile(tasksPath, "utf8")).split("\n");
        lines.splice(1, 0, "A sentence the run added above the list.", "");
        lines[4] = "- [x] 2.1 **Delegated to copilot-cli**: quote the audit line";
        await writeFile(tasksPath, lines.join("\n"), "utf8");
      }),
    });

    // Located by its number, so the silent tick is still caught.
    expect(result).toMatchObject({ status: "ran", gate: { kind: "reverted" } });
    expect((await readFile(tasksPath, "utf8")).split("\n")[4])
      .toBe("- [ ] 2.1 **Delegated to copilot-cli**: quote the audit line");
  });

  it("says the item could not be found rather than guessing, when the run deleted it", async () => {
    const { root, tasksPath } = await workspace(TASKS);
    const auditLog = new InMemoryAuditLog();

    const result = await runDelegatedItem({
      workspaceRoot: root,
      changeName: "demo",
      lineNumber: 2,
      resolveRunner: () => runnerOver(auditLog, root, async () => {
        const lines = (await readFile(tasksPath, "utf8")).split("\n");
        lines.splice(2, 1);
        await writeFile(tasksPath, lines.join("\n"), "utf8");
      }),
    });

    expect(result).toMatchObject({ status: "ran", gate: { kind: "item-not-found" } });
    expect(result.message).toContain("could not be found again");
  });
});
