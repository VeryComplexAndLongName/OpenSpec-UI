import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";
import { DEFAULT_AGENT_ID, type AgentRunner, type Command, type Event } from "@openspec-ui/core";
import { runChange, type RunChangeDeps } from "./run-change.js";

// every-varying-check-has-a-budget: no agent is ever spawned here — the
// chain runner itself is injected — so each test is a handful of file
// writes and an in-memory generator. Measured 2026-09-11 under 100ms for
// the slowest.
vi.setConfig({ testTimeout: 15_000 });

const temporaryRoots: string[] = [];

async function temporaryRoot(): Promise<string> {
  const root = await mkdtemp(path.join(os.tmpdir(), "openspec-cli-run-"));
  temporaryRoots.push(root);
  return root;
}

afterEach(async () => {
  await Promise.all(temporaryRoots.splice(0).map((root) => rm(root, { recursive: true, force: true })));
});

async function makeChange(root: string, changeName: string, harness?: Record<string, unknown>): Promise<void> {
  const changeDir = path.join(root, "openspec", "changes", changeName);
  await mkdir(changeDir, { recursive: true });
  await writeFile(path.join(changeDir, "proposal.md"), "# A change\n\n## Why\n\nBecause.\n", "utf8");
  await writeFile(path.join(changeDir, "tasks.md"), "- [ ] 1.1 Do the thing\n", "utf8");
  if (harness) await writeFile(path.join(changeDir, "harness.json"), JSON.stringify(harness), "utf8");
}

/** An unattended change: a chain, and nothing to ask anybody. */
const UNATTENDED = { autonomyLevel: "semi-autonomous", checkpoints: { requireConfirmationBetweenSteps: false } };

function collectingIo() {
  const out: string[] = [];
  const err: string[] = [];
  return { out, err, stdout: (text: string) => out.push(text), stderr: (line: string) => err.push(line) };
}

/** A chain runner that yields a scripted event stream. Nothing here
 * spawns anything: the point of these tests is the exit code and the
 * output, and a real agent would make both slower and less certain. */
function scriptedChain(events: Event[], hooks: { beforeEvents?: () => void } = {}) {
  const confirmed: string[] = [];
  const cancelled: string[] = [];
  return {
    confirmed,
    cancelled,
    create: () => ({
      async *run(command: Command) {
        hooks.beforeEvents?.();
        for (const event of events) yield { ...event, runId: command.runId } as Event;
      },
      confirmCheckpoint(runId: string) {
        confirmed.push(runId);
        return true;
      },
      cancel(runId: string) {
        cancelled.push(runId);
        return true;
      },
    }),
  };
}

const at = "2026-09-11T00:00:00.000Z";

function deps(
  io: ReturnType<typeof collectingIo>,
  chain: ReturnType<typeof scriptedChain>,
  checkpoint: RunChangeDeps["checkpoint"] = { ask: () => Promise.resolve(true) },
): RunChangeDeps {
  return {
    stdout: io.stdout,
    stderr: io.stderr,
    checkpoint,
    // The preflight resolves a runner for every stage, so the registry
    // has to answer — but the runner is never asked to run anything: the
    // chain itself is injected below.
    createRunners: () => new Map<string, AgentRunner>([[DEFAULT_AGENT_ID, { run: () => { throw new Error("no agent runs in a unit test"); } } as unknown as AgentRunner]]),
    createChainRunner: chain.create,
    // A unit test must not install a process-wide signal handler.
    onInterrupt: () => () => undefined,
  };
}

describe("runChange", () => {
  it("exits 0 when the chain completes", async () => {
    const root = await temporaryRoot();
    await makeChange(root, "a-change", UNATTENDED);
    const io = collectingIo();
    const chain = scriptedChain([
      { kind: "stageStarted", runId: "", timestamp: at, stage: "propose", agentId: "claude-cli" },
      { kind: "completed", runId: "", timestamp: at, summary: "archived a-change" },
    ]);

    const code = await runChange({ workspaceRoot: root, changeName: "a-change", format: "text" }, deps(io, chain));

    expect(code).toBe(0);
    expect(io.out.join("")).toContain("propose — claude-cli");
    expect(io.out.join("")).toContain("archived a-change");
  });

  it("exits 1 when a stage fails, and prints the reason", async () => {
    const root = await temporaryRoot();
    await makeChange(root, "a-change", UNATTENDED);
    const io = collectingIo();
    const chain = scriptedChain([{ kind: "failed", runId: "", timestamp: at, reason: "apply left tasks unchecked" }]);

    const code = await runChange({ workspaceRoot: root, changeName: "a-change", format: "text" }, deps(io, chain));

    expect(code).toBe(1);
    expect(io.out.join("")).toContain("apply left tasks unchecked");
  });

  it("exits 1 when the run is cancelled", async () => {
    const root = await temporaryRoot();
    await makeChange(root, "a-change", UNATTENDED);
    const io = collectingIo();
    const chain = scriptedChain([{ kind: "cancelled", runId: "", timestamp: at }]);

    const code = await runChange({ workspaceRoot: root, changeName: "a-change", format: "text" }, deps(io, chain));

    expect(code).toBe(1);
  });

  it("exits 1 when the stream ends without saying how", async () => {
    // Silence is not success. A chain whose own account of itself is
    // missing has not been shown to have worked, and reporting 0 here is
    // how a broken chain reads as a green build.
    const root = await temporaryRoot();
    await makeChange(root, "a-change", UNATTENDED);
    const io = collectingIo();
    const chain = scriptedChain([{ kind: "stageStarted", runId: "", timestamp: at, stage: "propose", agentId: "x" }]);

    const code = await runChange({ workspaceRoot: root, changeName: "a-change", format: "text" }, deps(io, chain));

    expect(code).toBe(1);
    expect(io.err.join("\n")).toContain("without reporting an outcome");
  });

  it("exits 2 and starts nothing when the change's level has no chain", async () => {
    const root = await temporaryRoot();
    await makeChange(root, "a-change");
    const io = collectingIo();
    const chain = scriptedChain([{ kind: "completed", runId: "", timestamp: at }]);
    let chainMade = false;

    const code = await runChange(
      { workspaceRoot: root, changeName: "a-change", format: "text" },
      {
        ...deps(io, chain),
        createChainRunner: () => {
          chainMade = true;
          return chain.create();
        },
      },
    );

    expect(code).toBe(2);
    expect(chainMade).toBe(false);
    expect(io.err.join("\n")).toContain("autonomyLevel");
  });

  it("exits 2 when a confirmation is configured and nobody can answer", async () => {
    const root = await temporaryRoot();
    await makeChange(root, "a-change", { autonomyLevel: "semi-autonomous" });
    const io = collectingIo();
    const chain = scriptedChain([{ kind: "completed", runId: "", timestamp: at }]);

    const code = await runChange(
      { workspaceRoot: root, changeName: "a-change", format: "text" },
      deps(io, chain, {}),
    );

    expect(code).toBe(2);
    expect(io.err.join("\n")).toContain("checkpoints.requireConfirmationBetweenSteps");
  });

  it("puts a checkpoint to the person and continues on yes", async () => {
    const root = await temporaryRoot();
    await makeChange(root, "a-change", { autonomyLevel: "semi-autonomous" });
    const io = collectingIo();
    const asked: string[] = [];
    const chain = scriptedChain([
      { kind: "checkpoint", runId: "", timestamp: at, stage: "propose", nextStage: "review", nextAgentId: "claude-cli" },
      { kind: "completed", runId: "", timestamp: at, summary: "done" },
    ]);

    const code = await runChange(
      { workspaceRoot: root, changeName: "a-change", format: "text" },
      deps(io, chain, {
        ask: (question) => {
          asked.push(question);
          return Promise.resolve(true);
        },
      }),
    );

    expect(code).toBe(0);
    expect(asked).toEqual(['Continue to "review" (claude-cli)?']);
    expect(chain.confirmed).toHaveLength(1);
    expect(chain.cancelled).toHaveLength(0);
  });

  it("cancels the chain when the person says no", async () => {
    const root = await temporaryRoot();
    await makeChange(root, "a-change", { autonomyLevel: "semi-autonomous" });
    const io = collectingIo();
    const chain = scriptedChain([
      { kind: "checkpoint", runId: "", timestamp: at, stage: "propose", nextStage: "review", nextAgentId: "" },
      { kind: "cancelled", runId: "", timestamp: at },
    ]);

    const code = await runChange(
      { workspaceRoot: root, changeName: "a-change", format: "text" },
      deps(io, chain, { ask: () => Promise.resolve(false) }),
    );

    expect(code).toBe(1);
    expect(chain.cancelled).toHaveLength(1);
    expect(chain.confirmed).toHaveLength(0);
  });

  it("writes one parseable JSON object per line, as each event arrives", async () => {
    const root = await temporaryRoot();
    await makeChange(root, "a-change", UNATTENDED);
    const io = collectingIo();
    const chain = scriptedChain([
      { kind: "stageStarted", runId: "", timestamp: at, stage: "propose", agentId: "claude-cli" },
      { kind: "stdout", runId: "", timestamp: at, chunk: "half a sen" },
      { kind: "completed", runId: "", timestamp: at, summary: "done" },
    ]);

    const code = await runChange({ workspaceRoot: root, changeName: "a-change", format: "json" }, deps(io, chain));

    expect(code).toBe(0);
    // One write per event, each its own complete line — not one document
    // assembled at the end.
    expect(io.out).toHaveLength(3);
    for (const written of io.out) {
      expect(written.endsWith("\n")).toBe(true);
      expect(() => JSON.parse(written) as unknown).not.toThrow();
    }
    expect((JSON.parse(io.out[1] as string) as { kind: string }).kind).toBe("stdout");
  });

  it("refuses to start while another host holds the workspace", async () => {
    const root = await temporaryRoot();
    await makeChange(root, "a-change", UNATTENDED);
    await mkdir(path.join(root, ".openspec-ui"), { recursive: true });
    await writeFile(
      path.join(root, ".openspec-ui", "workspace.lease.json"),
      JSON.stringify({
        version: 1,
        holderId: "someone-else",
        hostKind: "vscode-extension",
        hostname: "this-machine",
        pid: 999,
        acquiredAt: new Date().toISOString(),
        heartbeatAt: new Date().toISOString(),
      }),
      "utf8",
    );
    const io = collectingIo();
    const chain = scriptedChain([{ kind: "completed", runId: "", timestamp: at }]);

    const code = await runChange({ workspaceRoot: root, changeName: "a-change", format: "text" }, deps(io, chain));

    expect(code).toBe(2);
    expect(io.err.join("\n")).toContain("VS Code extension");
  });

  it("releases the workspace when the run finishes", async () => {
    const root = await temporaryRoot();
    await makeChange(root, "a-change", UNATTENDED);
    const io = collectingIo();
    const chain = scriptedChain([{ kind: "completed", runId: "", timestamp: at }]);

    await runChange({ workspaceRoot: root, changeName: "a-change", format: "text" }, deps(io, chain));

    // A lease left behind would make the next run wait out the whole
    // staleness window for nothing.
    const { access } = await import("node:fs/promises");
    await expect(access(path.join(root, ".openspec-ui", "workspace.lease.json"))).rejects.toThrow();
  });

  it("cancels the chain on an interrupt rather than abandoning the agent", async () => {
    const root = await temporaryRoot();
    await makeChange(root, "a-change", UNATTENDED);
    const io = collectingIo();
    let fire: (() => void) | undefined;
    // Fired once the chain is actually running, which is the only moment
    // an interrupt has anything to cancel.
    const chain = scriptedChain(
      [{ kind: "cancelled", runId: "", timestamp: at, reason: "interrupted" }],
      { beforeEvents: () => fire?.() },
    );
    let removed = false;

    const code = await runChange(
      { workspaceRoot: root, changeName: "a-change", format: "text" },
      {
        ...deps(io, chain),
        onInterrupt: (handler) => {
          fire = handler;
          return () => {
            removed = true;
          };
        },
      },
    );

    expect(code).toBe(1);
    expect(chain.cancelled).toHaveLength(1);
    expect(io.err.join("\n")).toContain("cancelling");
    // The handler is removed on the way out — a CLI that leaves one
    // installed keeps a reference to a finished run.
    expect(removed).toBe(true);
  });
});
