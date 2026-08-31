import { EventEmitter } from "node:events";
import { mkdtemp, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { AgentRunner } from "./agent-runner.js";
import type { Command, Event } from "./protocol.js";
import { writeChangeHarnessConfig, writeGlobalHarnessConfig } from "./harness-config.js";

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

/** `openspec status --change <name> --json` shape (see
 * `openspec-fixtures/status.json`) — `proposeDone` controls whether
 * `proposal`/`design`/`tasks` all report `"done"`; `remaining` controls
 * `progress.remaining`. */
function statusFixture(proposeDone: boolean, remaining: number): unknown {
  const artifactStatus = proposeDone ? "done" : "pending";
  return {
    changeName: "demo",
    schemaName: "spec-driven",
    progress: { total: 3, complete: remaining === 0 ? 3 : 3 - remaining, remaining },
    artifacts: [
      { id: "proposal", outputPath: "proposal.md", status: artifactStatus, requires: [] },
      { id: "design", outputPath: "design.md", status: artifactStatus, requires: [] },
      { id: "tasks", outputPath: "tasks.md", status: artifactStatus, requires: [] },
    ],
    root: { path: "/workspace", source: "cwd" },
  };
}

function mockStatus(proposeDone: boolean, remaining: number): void {
  mockCliJson(statusFixture(proposeDone, remaining));
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
  it("runs propose -> review -> apply -> archive with a checkpoint at each transition", async () => {
    const root = await temporaryRoot();
    await writeGlobalHarnessConfig(root, {
      autonomyLevel: "semi-autonomous",
      stepAgents: { propose: "claude-cli", review: "claude-cli", apply: "claude-cli" },
    });
    mockStatus(false, 3); // propose not done yet -> chain starts at "propose"
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
    ]);
    expect(checkpoints.map((e) => (e as { nextStage: string }).nextStage)).toEqual(["review", "apply", "archive"]);
    // Intermediate stages' own raw "completed" events are swallowed, not forwarded.
    expect(events.filter((e) => e.kind === "completed")).toHaveLength(1);
    expect(events.at(-1)).toMatchObject({ kind: "completed" });
    expect(events.some((e) => e.kind === "stageCompleted")).toBe(false);
  });

  it("cancelling at a checkpoint ends the chain without starting the next stage", async () => {
    const root = await temporaryRoot();
    await writeGlobalHarnessConfig(root, { autonomyLevel: "semi-autonomous" });
    mockStatus(false, 3);

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
    mockStatus(false, 3);
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
    expect(calls.map((c) => c.kind)).toEqual(["plan", "review", "implement"]);
  });

  it("a paused chain does not silently complete while waiting at a checkpoint", async () => {
    const root = await temporaryRoot();
    await writeGlobalHarnessConfig(root, { autonomyLevel: "semi-autonomous" });
    mockStatus(false, 3);

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
    mockStatus(false, 3);
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
    ]);
    expect(events.at(-1)).toMatchObject({ kind: "completed" });
    expect(calls.map((c) => c.kind)).toEqual(["plan", "review", "implement"]);
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
  it("ends with completed after archive and never starts a git stage", async () => {
    const root = await temporaryRoot();
    await writeGlobalHarnessConfig(root, {
      autonomyLevel: "semi-autonomous",
      stepAgents: { git: "claude-cli" },
    });
    mockStatus(true, 0); // propose done, no tasks remaining -> chain starts at "archive"
    mockArchiveSucceeds();

    const { runner, calls } = makeCompletingRunner();
    const chain = new HarnessChainRunner({ resolveRunner: () => runner });

    const events: Event[] = [];
    for await (const event of chain.run(baseCommand(root))) events.push(event);

    expect(events.map((e) => e.kind)).toEqual(["started", "completed"]);
    expect(calls).toHaveLength(0); // archive is mechanical — no AgentRunner invoked at all
  });
});

describe("HarnessChainRunner — cancellation mid-stage", () => {
  it("mirrors the single-stage cancel convention and ends the chain once the stage's own run ends", async () => {
    const root = await temporaryRoot();
    await writeGlobalHarnessConfig(root, { autonomyLevel: "semi-autonomous" });
    mockStatus(false, 3);

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
    mockStatus(false, 3);

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
    mockStatus(false, 3);

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
