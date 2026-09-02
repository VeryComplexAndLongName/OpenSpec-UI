import { EventEmitter } from "node:events";
import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { AgentRunner } from "./agent-runner.js";
import type { Command, Event } from "./protocol.js";
import { writeChangeHarnessConfig, writeGlobalHarnessConfig } from "./harness-config.js";
import { FileAuditLog, auditLogPath } from "./security.js";

// `HarnessChainRunner` shells out to the real `openspec` CLI for
// `statusChange`/`archiveChange` (via `openspec.ts`) — mock `cross-spawn`
// the same way `openspec.test.ts` does, rather than mocking this module's
// own boundary functions, so the real JSON-parsing/validation path is
// still exercised.
class FakeChildProcess extends EventEmitter {
  stdout = new EventEmitter();
  stderr = new EventEmitter();
}

const spawnMock = vi.fn();
vi.mock("cross-spawn", () => ({
  default: (...args: unknown[]) => spawnMock(...args),
}));

const { HarnessChainRunner } = await import("./harness-chain-runner.js");
const harnessConfigModule = await import("./harness-config.js");

/** Queues one fake CLI invocation. Unlike scheduling `queueMicrotask` at
 * setup time (which races ahead of `execFileAsync` actually attaching its
 * listeners when more than one call is queued before the code under test
 * runs), the child is created — and its emission scheduled — only once
 * `crossSpawn` is actually invoked, so `execFileAsync`'s synchronous
 * `.on("data")`/`.on("close")` listener attachment always happens first. */
function mockCliJson(stdout: unknown): void {
  spawnMock.mockImplementationOnce(() => {
    const child = new FakeChildProcess();
    queueMicrotask(() => {
      child.stdout.emit("data", Buffer.from(JSON.stringify(stdout), "utf8"));
      child.emit("close", 0);
    });
    return child;
  });
}

/** `openspec status --change <name> --json` shape as this repository's CLI
 * actually emits it (see `openspec-fixtures/status.json`) — `proposeDone`
 * controls whether `proposal`/`design`/`tasks` all report `"done"`, i.e.
 * whether those FILES EXIST. No `progress` field: the real CLI reports
 * none for a change, which is exactly why the chain must not depend on it
 * (see openspec/changes/harness-chain-archive-gate/proposal.md). */
function statusFixture(proposeDone: boolean): unknown {
  const artifactStatus = proposeDone ? "done" : "pending";
  return {
    changeName: "demo",
    schemaName: "spec-driven",
    artifacts: [
      { id: "proposal", outputPath: "proposal.md", status: artifactStatus, requires: [] },
      { id: "design", outputPath: "design.md", status: artifactStatus, requires: [] },
      { id: "tasks", outputPath: "tasks.md", status: artifactStatus, requires: [] },
    ],
    root: { path: "/workspace", source: "cwd" },
  };
}

function mockStatus(proposeDone: boolean): void {
  mockCliJson(statusFixture(proposeDone));
}

/** Writes `openspec/changes/demo/tasks.md` with `unchecked` incomplete and
 * `checked` complete task lines — the only signal the chain is now allowed
 * to read for "is the implementation done". */
async function writeTasks(root: string, unchecked: number, checked: number): Promise<void> {
  const changeDir = path.join(root, "openspec", "changes", "demo");
  await mkdir(changeDir, { recursive: true });
  const lines = [
    "## 1. Tasks",
    "",
    ...Array.from({ length: checked }, (_, index) => `- [x] 1.${index + 1} done`),
    ...Array.from({ length: unchecked }, (_, index) => `- [ ] 2.${index + 1} not done`),
    "",
  ];
  await writeFile(path.join(changeDir, "tasks.md"), lines.join("\n"), "utf8");
}

function mockArchiveSucceeds(): void {
  mockCliJson({});
}

/** A fake `AgentRunner` whose `run()` yields `started` then `completed` for
 * any command except one whose `kind === "cancel"`, which yields nothing
 * (matching the product's real cancel semantics closely enough for these
 * tests — see harness-chain-runner.ts's `cancel()` doc comment). Records
 * every command it was asked to run. */
function makeCompletingRunner(): { runner: AgentRunner; calls: Command[] } {
  const calls: Command[] = [];
  const runner: AgentRunner = {
    async *run(command) {
      calls.push(command);
      if (command.kind === "cancel") return;
      yield { kind: "started", runId: command.runId, timestamp: "t", command: command.kind, cwd: command.cwd };
      yield { kind: "completed", runId: command.runId, timestamp: "t", summary: `${command.kind} done` };
    },
  };
  return { runner, calls };
}

const temporaryRoots: string[] = [];
async function temporaryRoot(): Promise<string> {
  const root = await mkdtemp(path.join(os.tmpdir(), "openspec-harness-chain-"));
  temporaryRoots.push(root);
  return root;
}

afterEach(async () => {
  vi.restoreAllMocks();
  await Promise.all(temporaryRoots.splice(0).map((root) => rm(root, { recursive: true, force: true })));
});

function baseCommand(cwd: string): Command {
  return {
    kind: "chain",
    cwd,
    runId: "chain-run-1",
    context: { changeDir: path.join(cwd, "openspec", "changes", "demo") },
  };
}

describe("HarnessChainRunner — assisted level", () => {
  it("refuses to run a chain when the resolved autonomyLevel is assisted", async () => {
    const root = await temporaryRoot();
    const { runner } = makeCompletingRunner();
    const chain = new HarnessChainRunner({ resolveRunner: () => runner });

    const events: Event[] = [];
    for await (const event of chain.run(baseCommand(root))) events.push(event);

    expect(events.map((e) => e.kind)).toEqual(["started", "failed"]);
    expect(events[1]).toMatchObject({ reason: expect.stringContaining("assisted") });
  });
});

describe("HarnessChainRunner — semi-autonomous", () => {
  it("runs propose -> review -> apply -> verify -> archive with a checkpoint at each transition", async () => {
    const root = await temporaryRoot();
    await writeGlobalHarnessConfig(root, {
      autonomyLevel: "semi-autonomous",
      stepAgents: { propose: "claude-cli", review: "claude-cli", apply: "claude-cli", verify: "claude-cli" },
    });
    mockStatus(false); // propose not done yet -> chain starts at "propose"
    // The chain refuses to archive while any task is unchecked, and the
    // fake agent below does not edit tasks.md — write it already complete.
    await writeTasks(root, 0, 3);
    mockArchiveSucceeds();

    const { runner } = makeCompletingRunner();
    const chain = new HarnessChainRunner({ resolveRunner: () => runner });
    const command = baseCommand(root);

    const events: Event[] = [];
    for await (const event of chain.run(command)) {
      events.push(event);
      if (event.kind === "checkpoint") chain.confirmCheckpoint(command.runId);
    }

    const checkpoints = events.filter((e) => e.kind === "checkpoint");
    expect(checkpoints.map((e) => (e as { stage: string; nextStage: string }).stage)).toEqual([
      "propose",
      "review",
      "apply",
      "verify",
    ]);
    expect(checkpoints.map((e) => (e as { nextStage: string }).nextStage)).toEqual([
      "review",
      "apply",
      "verify",
      "archive",
    ]);
    // Intermediate stages' own raw "completed" events are swallowed, not forwarded.
    expect(events.filter((e) => e.kind === "completed")).toHaveLength(1);
    expect(events.at(-1)).toMatchObject({ kind: "completed" });
    expect(events.some((e) => e.kind === "stageCompleted")).toBe(false);
  });

  it("cancelling at a checkpoint ends the chain without starting the next stage", async () => {
    const root = await temporaryRoot();
    await writeGlobalHarnessConfig(root, { autonomyLevel: "semi-autonomous" });
    mockStatus(false);

    const { runner, calls } = makeCompletingRunner();
    const chain = new HarnessChainRunner({ resolveRunner: () => runner });
    const command = baseCommand(root);

    const generator = chain.run(command);
    const { events } = await collectUntilThenAct(generator, (e) => e.kind === "checkpoint", () => {
      expect(chain.cancel(command.runId)).toBe(true);
    });

    expect(events.at(-1)).toMatchObject({ kind: "cancelled" });
    // Only the "propose" stage ran (mapped to "plan") — review never started.
    expect(calls.map((c) => c.kind)).toEqual(["plan"]);
  });

  it("confirming a checkpoint resumes into the next stage's agent", async () => {
    const root = await temporaryRoot();
    await writeGlobalHarnessConfig(root, { autonomyLevel: "semi-autonomous" });
    mockStatus(false);
    await writeTasks(root, 0, 3);
    mockArchiveSucceeds();

    const { runner, calls } = makeCompletingRunner();
    const chain = new HarnessChainRunner({ resolveRunner: () => runner });
    const command = baseCommand(root);

    const events: Event[] = [];
    const generator = chain.run(command);
    void (async () => {
      for await (const event of generator) {
        events.push(event);
        if (event.kind === "checkpoint") chain.confirmCheckpoint(command.runId);
      }
    })();

    await vi.waitFor(() => expect(events.at(-1)).toMatchObject({ kind: "completed" }));
    expect(calls.map((c) => c.kind)).toEqual(["plan", "review", "implement", "verify"]);
  });

  it("a paused chain does not silently complete while waiting at a checkpoint", async () => {
    const root = await temporaryRoot();
    await writeGlobalHarnessConfig(root, { autonomyLevel: "semi-autonomous" });
    mockStatus(false);

    const { runner } = makeCompletingRunner();
    const chain = new HarnessChainRunner({ resolveRunner: () => runner });
    const command = baseCommand(root);

    const events: Event[] = [];
    const pump = (async () => {
      for await (const event of chain.run(command)) events.push(event);
    })();

    await vi.waitFor(() => expect(events.some((e) => e.kind === "checkpoint")).toBe(true));
    expect(events.some((e) => e.kind === "completed" || e.kind === "failed" || e.kind === "cancelled")).toBe(false);
    // Still genuinely tracked (not garbage-collected/forgotten) — confirming resumes it.
    expect(chain.confirmCheckpoint(command.runId)).toBe(true);

    // Resuming runs "review" and pauses at the next checkpoint too — still
    // not silently complete. End the test here (not the concern of this
    // test) via cancel, rather than draining the whole sequence.
    await vi.waitFor(() => expect(events.filter((e) => e.kind === "checkpoint")).toHaveLength(2));
    expect(events.some((e) => e.kind === "completed" || e.kind === "failed" || e.kind === "cancelled")).toBe(false);
    expect(chain.cancel(command.runId)).toBe(true);
    await pump;
  });
});

describe("HarnessChainRunner — autonomous", () => {
  it("runs the full sequence with no checkpoints when the per-change file itself sets autonomous", async () => {
    const root = await temporaryRoot();
    await writeGlobalHarnessConfig(root, { autonomyLevel: "semi-autonomous" });
    await writeChangeHarnessConfig(root, "demo", { autonomyLevel: "autonomous" });
    mockStatus(false);
    await writeTasks(root, 0, 3);
    mockArchiveSucceeds();

    const { runner, calls } = makeCompletingRunner();
    const chain = new HarnessChainRunner({ resolveRunner: () => runner });

    const events: Event[] = [];
    for await (const event of chain.run(baseCommand(root))) events.push(event);

    expect(events.some((e) => e.kind === "checkpoint")).toBe(false);
    expect(events.filter((e) => e.kind === "stageCompleted").map((e) => (e as { stage: string }).stage)).toEqual([
      "propose",
      "review",
      "apply",
      "verify",
    ]);
    expect(events.at(-1)).toMatchObject({ kind: "completed" });
    expect(calls.map((c) => c.kind)).toEqual(["plan", "review", "implement", "verify"]);
  });

  it("refuses autonomous when the independently re-read per-change file does not itself confirm it", async () => {
    const root = await temporaryRoot();
    await writeGlobalHarnessConfig(root, { autonomyLevel: "semi-autonomous" });
    await writeChangeHarnessConfig(root, "demo", { autonomyLevel: "autonomous" });

    // Simulate a merge-layer bug: resolveHarnessConfig legitimately says
    // "autonomous" (real per-change file), but harness-chain-runner's own
    // independent re-check of readChangeHarnessConfig disagrees — this
    // must still be refused, not trusted from the merged config alone.
    const spy = vi.spyOn(harnessConfigModule, "readChangeHarnessConfig").mockResolvedValueOnce(undefined);

    const { runner } = makeCompletingRunner();
    const chain = new HarnessChainRunner({ resolveRunner: () => runner });

    const events: Event[] = [];
    for await (const event of chain.run(baseCommand(root))) events.push(event);

    expect(events.map((e) => e.kind)).toEqual(["started", "failed"]);
    expect(events[1]).toMatchObject({ reason: expect.stringContaining("autonomous") });
    spy.mockRestore();
  });
});

describe("HarnessChainRunner — hard stop before git", () => {
  it("ends with completed after verify -> archive and never starts a git stage", async () => {
    const root = await temporaryRoot();
    await writeGlobalHarnessConfig(root, {
      autonomyLevel: "semi-autonomous",
      stepAgents: { git: "claude-cli" },
    });
    mockStatus(true); // every propose artifact exists
    await writeTasks(root, 0, 3); // ...and every task is checked -> starts at "verify"
    mockArchiveSucceeds();

    const { runner, calls } = makeCompletingRunner();
    const chain = new HarnessChainRunner({ resolveRunner: () => runner });
    const command = baseCommand(root);

    const events: Event[] = [];
    for await (const event of chain.run(command)) {
      events.push(event);
      if (event.kind === "checkpoint") chain.confirmCheckpoint(command.runId);
    }

    expect(events.at(-1)).toMatchObject({ kind: "completed" });
    // Only "verify" ran through an AgentRunner — archive is mechanical, and
    // "git" never runs under any configuration (ADR 0012's hard stop).
    expect(calls.map((c) => c.kind)).toEqual(["verify"]);
  });
});

describe("HarnessChainRunner — verify stage (task 5.1/5.6)", () => {
  it("resolves stepAgents.verify's configured agent for the verify stage", async () => {
    const root = await temporaryRoot();
    await writeGlobalHarnessConfig(root, {
      autonomyLevel: "semi-autonomous",
      stepAgents: { verify: "gemini-cli" },
    });
    mockStatus(true);
    await writeTasks(root, 0, 3); // every task checked -> starts at "verify"
    mockArchiveSucceeds();

    const resolvedAgentIds: (string | undefined)[] = [];
    const { runner } = makeCompletingRunner();
    const chain = new HarnessChainRunner({
      resolveRunner: (agentId) => {
        resolvedAgentIds.push(agentId);
        return runner;
      },
    });
    const command = baseCommand(root);

    const events: Event[] = [];
    for await (const event of chain.run(command)) {
      events.push(event);
      if (event.kind === "checkpoint") chain.confirmCheckpoint(command.runId);
    }

    expect(resolvedAgentIds).toEqual(["gemini-cli"]);
    expect(events.at(-1)).toMatchObject({ kind: "completed" });
  });

  it("resolves the default (undefined) agent for the verify stage when stepAgents.verify is unset", async () => {
    const root = await temporaryRoot();
    await writeGlobalHarnessConfig(root, { autonomyLevel: "semi-autonomous" });
    mockStatus(true);
    await writeTasks(root, 0, 3);
    mockArchiveSucceeds();

    const resolvedAgentIds: (string | undefined)[] = [];
    const { runner } = makeCompletingRunner();
    const chain = new HarnessChainRunner({
      resolveRunner: (agentId) => {
        resolvedAgentIds.push(agentId);
        return runner;
      },
    });
    const command = baseCommand(root);

    const events: Event[] = [];
    for await (const event of chain.run(command)) {
      events.push(event);
      if (event.kind === "checkpoint") chain.confirmCheckpoint(command.runId);
    }

    expect(resolvedAgentIds).toEqual([undefined]);
    expect(events.at(-1)).toMatchObject({ kind: "completed" });
  });

  /** Proves this change relies on the pre-existing archive gate rather
   * than duplicating it: HarnessChainRunner has no verify-specific outcome
   * handling at all — it just runs the verify stage and lets the SAME
   * task-count check that already guards `archive` re-read tasks.md. */
  it("stops before archive when the verify run leaves an unchecked task behind", async () => {
    const root = await temporaryRoot();
    await writeGlobalHarnessConfig(root, { autonomyLevel: "semi-autonomous" });
    mockStatus(true);
    await writeTasks(root, 0, 3); // every task checked -> starts at "verify"

    const calls: Command[] = [];
    const runner: AgentRunner = {
      async *run(command) {
        calls.push(command);
        if (command.kind === "cancel") return;
        yield { kind: "started", runId: command.runId, timestamp: "t", command: command.kind, cwd: command.cwd };
        if (command.kind === "verify") {
          // The verifying agent finds an overstated task and unchecks it —
          // by editing tasks.md itself, exactly as a real CLI agent would.
          await writeTasks(root, 1, 2);
        }
        yield { kind: "completed", runId: command.runId, timestamp: "t" };
      },
    };
    const chain = new HarnessChainRunner({ resolveRunner: () => runner });
    const command = baseCommand(root);

    const events: Event[] = [];
    for await (const event of chain.run(command)) {
      events.push(event);
      if (event.kind === "checkpoint") chain.confirmCheckpoint(command.runId);
    }

    expect(calls.map((c) => c.kind)).toEqual(["verify"]);
    expect(events.at(-1)).toMatchObject({ kind: "failed" });
    expect((events.at(-1) as { reason: string }).reason).toContain("1 task(s) still unchecked");
    expect(spawnMock.mock.calls.some((call) => (call[1] as string[])[0] === "archive")).toBe(false);
  });
});

describe("HarnessChainRunner — task completion gates the chain", () => {
  /** The incident of 2026-09-01, as a test: every artifact file existed, so
   * the old code read artifact presence as "no tasks remain" and went
   * straight to `archive`, archiving a change with 0 of 23 tasks done. */
  it("starts at apply, not archive, when every artifact exists but no task is checked", async () => {
    const root = await temporaryRoot();
    await writeGlobalHarnessConfig(root, { autonomyLevel: "semi-autonomous" });
    await writeChangeHarnessConfig(root, "demo", { autonomyLevel: "autonomous" });
    mockStatus(true);
    await writeTasks(root, 3, 0);

    const { runner, calls } = makeCompletingRunner();
    const chain = new HarnessChainRunner({ resolveRunner: () => runner });

    const events: Event[] = [];
    for await (const event of chain.run(baseCommand(root))) events.push(event);

    expect(calls.map((c) => c.kind)).toEqual(["implement", "verify"]);
    // Only `openspec status` ran — no `openspec archive` (verify's fake run
    // doesn't check any task, so the archive gate still refuses).
    expect(spawnMock.mock.calls.map((call) => (call[1] as string[])[0])).toEqual(["status"]);
  });

  it("starts at verify, not archive, when every task is checked", async () => {
    const root = await temporaryRoot();
    await writeGlobalHarnessConfig(root, { autonomyLevel: "semi-autonomous" });
    mockStatus(true);
    await writeTasks(root, 0, 3);
    mockArchiveSucceeds();

    const { runner, calls } = makeCompletingRunner();
    const chain = new HarnessChainRunner({ resolveRunner: () => runner });
    const command = baseCommand(root);

    const events: Event[] = [];
    for await (const event of chain.run(command)) {
      events.push(event);
      if (event.kind === "checkpoint") chain.confirmCheckpoint(command.runId);
    }

    expect(events.at(-1)).toMatchObject({ kind: "completed" });
    expect(calls.map((c) => c.kind)).toEqual(["verify"]);
    expect(spawnMock.mock.calls.map((call) => (call[1] as string[])[0])).toEqual(["status", "archive"]);
  });

  it("starts at apply when tasks.md cannot be read at all", async () => {
    const root = await temporaryRoot();
    await writeGlobalHarnessConfig(root, { autonomyLevel: "semi-autonomous" });
    await writeChangeHarnessConfig(root, "demo", { autonomyLevel: "autonomous" });
    mockStatus(true); // no tasks.md written -> task completion is unknown

    const { runner, calls } = makeCompletingRunner();
    const chain = new HarnessChainRunner({ resolveRunner: () => runner });

    const events: Event[] = [];
    for await (const event of chain.run(baseCommand(root))) events.push(event);

    expect(calls.map((c) => c.kind)).toEqual(["implement", "verify"]);
    expect(spawnMock.mock.calls.map((call) => (call[1] as string[])[0])).toEqual(["status"]);
  });

  it("refuses to archive when tasks remain unchecked, naming the change and the count", async () => {
    const root = await temporaryRoot();
    await writeGlobalHarnessConfig(root, { autonomyLevel: "semi-autonomous" });
    await writeChangeHarnessConfig(root, "demo", { autonomyLevel: "autonomous" });
    mockStatus(true);
    await writeTasks(root, 2, 1);

    const { runner } = makeCompletingRunner();
    const chain = new HarnessChainRunner({ resolveRunner: () => runner });

    const events: Event[] = [];
    for await (const event of chain.run(baseCommand(root))) events.push(event);

    // The chain started at `apply` (tasks unchecked) and then refused to
    // archive — the stage completing successfully is not evidence of work.
    expect(events.at(-1)).toMatchObject({ kind: "failed" });
    const reason = (events.at(-1) as { reason: string }).reason;
    expect(reason).toContain("demo");
    expect(reason).toContain("2 task(s) still unchecked");
    expect(spawnMock.mock.calls.some((call) => (call[1] as string[])[0] === "archive")).toBe(false);
  });

  it("refuses to archive when the task count cannot be determined", async () => {
    const root = await temporaryRoot();
    await writeGlobalHarnessConfig(root, { autonomyLevel: "semi-autonomous" });
    await writeChangeHarnessConfig(root, "demo", { autonomyLevel: "autonomous" });
    mockStatus(true);
    await writeTasks(root, 1, 0);

    const { runner } = makeCompletingRunner();
    const chain = new HarnessChainRunner({ resolveRunner: () => runner });

    // Remove tasks.md after the start-stage decision has been made, so the
    // archive gate itself is the code path facing an unreadable file.
    const events: Event[] = [];
    for await (const event of chain.run(baseCommand(root))) {
      events.push(event);
      if (event.kind === "started" && event.command === "implement") {
        await rm(path.join(root, "openspec", "changes", "demo", "tasks.md"), { force: true });
      }
    }

    expect(events.at(-1)).toMatchObject({ kind: "failed" });
    expect((events.at(-1) as { reason: string }).reason).toContain("demo");
    expect(spawnMock.mock.calls.some((call) => (call[1] as string[])[0] === "archive")).toBe(false);
  });
});

describe("HarnessChainRunner — cancellation mid-stage", () => {
  it("mirrors the single-stage cancel convention and ends the chain once the stage's own run ends", async () => {
    const root = await temporaryRoot();
    await writeGlobalHarnessConfig(root, { autonomyLevel: "semi-autonomous" });
    mockStatus(false);

    let releaseStage: (() => void) | undefined;
    const calls: Command[] = [];
    let cancelSignalled = false;
    const runner: AgentRunner = {
      async *run(command) {
        calls.push(command);
        if (command.kind === "cancel") {
          cancelSignalled = true;
          return;
        }
        yield { kind: "started", runId: command.runId, timestamp: "t", command: command.kind, cwd: command.cwd };
        await new Promise<void>((resolve) => {
          releaseStage = resolve;
        });
        yield cancelSignalled
          ? { kind: "cancelled", runId: command.runId, timestamp: "t" }
          : { kind: "completed", runId: command.runId, timestamp: "t" };
      },
    };
    const chain = new HarnessChainRunner({ resolveRunner: () => runner });
    const command = baseCommand(root);

    const events: Event[] = [];
    const pump = (async () => {
      for await (const event of chain.run(command)) events.push(event);
    })();

    await vi.waitFor(() => expect(events.some((e) => e.kind === "started" && e.timestamp === "t")).toBe(true));
    expect(chain.cancel(command.runId)).toBe(true);
    await vi.waitFor(() => expect(cancelSignalled).toBe(true));
    releaseStage?.();
    await pump;

    expect(events.at(-1)).toMatchObject({ kind: "cancelled" });
    expect(calls.map((c) => c.kind)).toEqual(["plan", "cancel"]);
  });
});

describe("HarnessChainRunner — misuse", () => {
  it("fails immediately for a non-chain command", async () => {
    const chain = new HarnessChainRunner({ resolveRunner: () => undefined });
    const events: Event[] = [];
    for await (const event of chain.run({ kind: "implement", cwd: "/x", runId: "r", context: { changeDir: "/x/openspec/changes/demo" } })) {
      events.push(event);
    }
    expect(events).toEqual([expect.objectContaining({ kind: "failed" })]);
  });

  it("confirmCheckpoint/cancel return false for an unknown runId", () => {
    const chain = new HarnessChainRunner({ resolveRunner: () => undefined });
    expect(chain.confirmCheckpoint("no-such-run")).toBe(false);
    expect(chain.cancel("no-such-run")).toBe(false);
  });
});

describe("HarnessChainRunner — asAgentRunner", () => {
  it("runs a chain command exactly like run() does", async () => {
    const root = await temporaryRoot();
    await writeGlobalHarnessConfig(root, { autonomyLevel: "semi-autonomous" });
    mockStatus(false);

    const { runner } = makeCompletingRunner();
    const chain = new HarnessChainRunner({ resolveRunner: () => runner });
    const adapter = chain.asAgentRunner();

    const events: Event[] = [];
    for await (const event of adapter.run(baseCommand(root))) {
      events.push(event);
      if (event.kind === "checkpoint") chain.cancel(baseCommand(root).runId);
    }

    expect(events.at(-1)).toMatchObject({ kind: "cancelled" });
  });

  it("routes a cancel command to cancel() instead of rejecting it as non-chain", async () => {
    const root = await temporaryRoot();
    await writeGlobalHarnessConfig(root, { autonomyLevel: "semi-autonomous" });
    mockStatus(false);

    const { runner } = makeCompletingRunner();
    const chain = new HarnessChainRunner({ resolveRunner: () => runner });
    const adapter = chain.asAgentRunner();
    const command = baseCommand(root);

    const events: Event[] = [];
    const pump = (async () => {
      for await (const event of adapter.run(command)) events.push(event);
    })();

    await vi.waitFor(() => expect(events.some((e) => e.kind === "checkpoint")).toBe(true));

    // A "cancel" sent through the adapter (mirroring how RunController
    // re-sends one to "the active runner") must resolve the pending
    // checkpoint via cancel(), not be rejected the way a bare
    // HarnessChainRunner.run({kind:"cancel"}) call would be.
    const cancelEvents: Event[] = [];
    for await (const event of adapter.run({ ...command, kind: "cancel" })) cancelEvents.push(event);
    expect(cancelEvents).toEqual([]);

    await pump;
    expect(events.at(-1)).toMatchObject({ kind: "cancelled" });
  });
});

describe("HarnessChainRunner — budget (task 8.7)", () => {
  it("stops before the next stage when recorded usage reaches the ceiling, and reports the budget reason", async () => {
    const root = await temporaryRoot();
    await writeGlobalHarnessConfig(root, {
      autonomyLevel: "semi-autonomous",
      stepAgents: { propose: "claude-cli", review: "claude-cli", apply: "claude-cli" },
      budget: { maxCostUsd: 1 },
    });
    mockStatus(false); // propose not done yet -> chain starts at "propose"

    const command = baseCommand(root);
    let calls = 0;
    const listAuditEntries = vi.fn(() => {
      calls += 1;
      // Nothing recorded before "propose" starts; by the time "review"
      // is about to start, "propose"'s own run has been recorded with
      // usage over the ceiling.
      if (calls === 1) return [];
      return [
        {
          runId: "propose-run",
          agent: "claude-cli",
          outcome: "completed" as const,
          cwd: root,
          timestamp: "t",
          changeDir: command.context.changeDir,
          usage: { costUsd: 5 },
        },
      ];
    });

    const { runner, calls: runnerCalls } = makeCompletingRunner();
    const chain = new HarnessChainRunner({ resolveRunner: () => runner, listAuditEntries });

    const events: Event[] = [];
    for await (const event of chain.run(command)) {
      events.push(event);
      if (event.kind === "checkpoint") chain.confirmCheckpoint(command.runId);
    }

    // Only "propose" (mapped to "plan") ran — "review" never started.
    expect(runnerCalls.map((c) => c.kind)).toEqual(["plan"]);
    expect(events.at(-1)).toMatchObject({ kind: "failed", reason: expect.stringContaining("budget") });
    expect(events.some((e) => e.kind === "completed")).toBe(false);
  });

  it("a chain with no ceiling behaves identically to today, even with high recorded usage", async () => {
    const root = await temporaryRoot();
    await writeGlobalHarnessConfig(root, {
      autonomyLevel: "semi-autonomous",
      stepAgents: { propose: "claude-cli", review: "claude-cli", apply: "claude-cli" },
    });
    mockStatus(false);
    await writeTasks(root, 0, 3);
    mockArchiveSucceeds();

    const command = baseCommand(root);
    const listAuditEntries = vi.fn(() => [
      {
        runId: "propose-run",
        agent: "claude-cli",
        outcome: "completed" as const,
        cwd: root,
        timestamp: "t",
        changeDir: command.context.changeDir,
        usage: { costUsd: 999 },
      },
    ]);

    const { runner } = makeCompletingRunner();
    const chain = new HarnessChainRunner({ resolveRunner: () => runner, listAuditEntries });

    const events: Event[] = [];
    for await (const event of chain.run(command)) {
      events.push(event);
      if (event.kind === "checkpoint") chain.confirmCheckpoint(command.runId);
    }

    expect(events.at(-1)).toMatchObject({ kind: "completed" });
  });

  it("a chain whose runs report no usage runs to completion despite a configured ceiling", async () => {
    const root = await temporaryRoot();
    await writeGlobalHarnessConfig(root, {
      autonomyLevel: "semi-autonomous",
      stepAgents: { propose: "claude-cli", review: "claude-cli", apply: "claude-cli" },
      budget: { maxCostUsd: 1 },
    });
    mockStatus(false);
    await writeTasks(root, 0, 3);
    mockArchiveSucceeds();

    const command = baseCommand(root);
    const listAuditEntries = vi.fn(() => [
      {
        runId: "propose-run",
        agent: "claude-cli",
        outcome: "completed" as const,
        cwd: root,
        timestamp: "t",
        changeDir: command.context.changeDir,
        // No `usage` — unmeasured, must not count against the ceiling.
      },
    ]);

    const { runner } = makeCompletingRunner();
    const chain = new HarnessChainRunner({ resolveRunner: () => runner, listAuditEntries });

    const events: Event[] = [];
    for await (const event of chain.run(command)) {
      events.push(event);
      if (event.kind === "checkpoint") chain.confirmCheckpoint(command.runId);
    }

    expect(events.at(-1)).toMatchObject({ kind: "completed" });
  });
});

describe("HarnessChainRunner — budget from persisted audit history (task 4.3, audit-log-persistence)", () => {
  it("counts entries recorded by a FileAuditLog before this process's own listAuditEntries reader was constructed", async () => {
    const root = await temporaryRoot();
    await writeGlobalHarnessConfig(root, {
      autonomyLevel: "semi-autonomous",
      stepAgents: { propose: "claude-cli", review: "claude-cli", apply: "claude-cli" },
      budget: { maxCostUsd: 1 },
    });
    mockStatus(false); // propose not done yet -> chain starts at "propose"

    const command = baseCommand(root);

    // Simulates a run recorded by an EARLIER process (e.g. before a host
    // restart) — a separate `FileAuditLog` instance, written and flushed
    // to `.openspec-ui/audit.jsonl` before this test's own chain ever
    // starts, standing in for "yesterday's process, already exited".
    const priorProcessAuditLog = new FileAuditLog(auditLogPath(root));
    priorProcessAuditLog.record({
      runId: "prior-process-run",
      agent: "claude-cli",
      outcome: "completed",
      cwd: root,
      timestamp: "t0",
      changeDir: command.context.changeDir,
      usage: { costUsd: 5 },
    });
    await vi.waitFor(async () => {
      expect(await priorProcessAuditLog.readEntries()).toHaveLength(1);
    });

    // This process's own reader — a fresh `FileAuditLog` instance over the
    // same file, exactly as `server.ts`/`extension.ts` construct one on
    // startup with no in-memory knowledge of the run recorded above.
    const currentProcessAuditLog = new FileAuditLog(auditLogPath(root));
    const { runner } = makeCompletingRunner();
    const chain = new HarnessChainRunner({
      resolveRunner: () => runner,
      listAuditEntries: () => currentProcessAuditLog.readEntries(),
    });

    const events: Event[] = [];
    for await (const event of chain.run(command)) {
      events.push(event);
      if (event.kind === "checkpoint") chain.confirmCheckpoint(command.runId);
    }

    // The budget was already exceeded by the prior process's recorded
    // spend, so "propose" never even starts — proving the reader picked up
    // history from disk, not from anything held in this process's memory.
    expect(events.at(-1)).toMatchObject({ kind: "failed", reason: expect.stringContaining("budget") });
    expect(events.some((e) => e.kind === "completed")).toBe(false);
  });
});

describe("HarnessChainRunner — stepAgents effort and budget reach the stage Command (harness-step-effort-and-budget)", () => {
  it("threads a stage's resolved effort and budget into the Command handed to the runner", async () => {
    const root = await temporaryRoot();
    await writeGlobalHarnessConfig(root, {
      autonomyLevel: "semi-autonomous",
      stepAgents: {
        apply: { agent: "claude-cli", model: "claude-haiku-4-5", effort: "high", budget: { maxCostUsd: 5 } },
      },
    });
    mockStatus(true); // artifacts already done, tasks unchecked -> chain starts at "apply"
    await writeTasks(root, 3, 0);

    const { runner, calls } = makeCompletingRunner();
    const chain = new HarnessChainRunner({ resolveRunner: () => runner });
    const command = baseCommand(root);

    const events: Event[] = [];
    for await (const event of chain.run(command)) {
      events.push(event);
      if (event.kind === "checkpoint") chain.confirmCheckpoint(command.runId);
    }

    const applyCall = calls.find((c) => c.kind === "implement");
    expect(applyCall).toMatchObject({
      agentId: "claude-cli",
      model: "claude-haiku-4-5",
      effort: "high",
      budget: { maxCostUsd: 5 },
    });
  });

  it("leaves effort and budget undefined for a stage whose stepAgents entry sets neither", async () => {
    const root = await temporaryRoot();
    await writeGlobalHarnessConfig(root, {
      autonomyLevel: "semi-autonomous",
      stepAgents: { apply: "claude-cli" },
    });
    mockStatus(true);
    await writeTasks(root, 3, 0);

    const { runner, calls } = makeCompletingRunner();
    const chain = new HarnessChainRunner({ resolveRunner: () => runner });
    const command = baseCommand(root);

    const events: Event[] = [];
    for await (const event of chain.run(command)) {
      events.push(event);
      if (event.kind === "checkpoint") chain.confirmCheckpoint(command.runId);
    }

    const applyCall = calls.find((c) => c.kind === "implement");
    expect(applyCall?.effort).toBeUndefined();
    expect(applyCall?.budget).toBeUndefined();
  });
});

/** Consumes `iterator` until `predicate` matches, invoking `onMatch`
 * synchronously right after the matching event (before resuming
 * iteration) — used to fire `cancel()`/`confirmCheckpoint()` at exactly
 * the moment a checkpoint is observed, then drains the rest. */
async function collectUntilThenAct(
  iterator: AsyncGenerator<Event>,
  predicate: (event: Event) => boolean,
  onMatch: () => void,
): Promise<{ events: Event[] }> {
  const events: Event[] = [];
  for await (const event of iterator) {
    events.push(event);
    if (predicate(event)) {
      onMatch();
    }
  }
  return { events };
}
