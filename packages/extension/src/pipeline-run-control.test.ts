import { describe, expect, it, vi } from "vitest";
import type { AgentRunner, Command, Event, LiveRun } from "@openspec-ui/core";
import { sendPipelineRunControl, type PipelineRunControlDeps } from "./pipeline-run-control.js";

// a-change-is-run-from-its-card 5.4–5.6 in the editor, and the defect 7.6's
// live run found: a card's Continue went where nothing answered it.

const chainRun: LiveRun = {
  runId: "r1",
  cwd: "/repo",
  changeName: "alpha",
  kind: "chain",
  startedAt: "2026-09-14T00:00:00.000Z",
  waiting: true,
  permissionRequestId: null,
  stopRequested: null,
};

function setUp(options: { chain?: boolean; runs?: LiveRun[] } = {}) {
  const received: Command[] = [];
  const recording: AgentRunner = {
    // eslint-disable-next-line require-yield
    async *run(command: Command): AsyncIterable<Event> {
      received.push(command);
    },
  };
  const chainRunner = {
    holds: vi.fn(() => options.chain ?? true),
    confirmCheckpoint: vi.fn(() => true),
    resolvePermission: vi.fn(() => true),
    asAgentRunner: vi.fn(() => recording),
  };
  const resolveRunner = vi.fn(() => recording);
  const runs = options.runs ?? [chainRun];
  const deps = {
    liveRuns: { get: (runId: string) => runs.find((run) => run.runId === runId) },
    chainRunner,
    resolveRunner,
  } as unknown as PipelineRunControlDeps;
  return { deps, chainRunner, resolveRunner, received };
}

describe("sendPipelineRunControl", () => {
  it("answers a chain's checkpoint on the chain runner itself, not through its agent runner", () => {
    const { deps, chainRunner } = setUp();

    sendPipelineRunControl({ changeName: "alpha", runId: "r1", kind: "confirmCheckpoint" }, deps);

    expect(chainRunner.confirmCheckpoint).toHaveBeenCalledWith("r1");
    expect(chainRunner.asAgentRunner).not.toHaveBeenCalled();
  });

  it("answers a chain's permission on the chain runner, with the request and the outcome", () => {
    const { deps, chainRunner } = setUp();

    sendPipelineRunControl(
      { changeName: "alpha", runId: "r1", kind: "resolvePermission", permissionRequestId: "p1", permissionOutcome: "deny" },
      deps,
    );

    expect(chainRunner.resolvePermission).toHaveBeenCalledWith(
      expect.objectContaining({ kind: "resolvePermission", runId: "r1", cwd: "/repo", permissionRequestId: "p1", permissionOutcome: "deny" }),
    );
    expect(chainRunner.asAgentRunner).not.toHaveBeenCalled();
  });

  it("sends a chain's stop through the chain's agent runner, with its reason", async () => {
    const { deps, chainRunner, received } = setUp();

    sendPipelineRunControl({ changeName: "alpha", runId: "r1", kind: "stop", reason: "wrong branch" }, deps);

    await vi.waitFor(() => expect(received).toEqual([expect.objectContaining({ kind: "stop", runId: "r1", reason: "wrong branch" })]));
    expect(chainRunner.asAgentRunner).toHaveBeenCalled();
  });

  it("sends a single-stage run's cancel to the runner it was started on", async () => {
    const { deps, resolveRunner, received } = setUp({ chain: false, runs: [{ ...chainRun, kind: "implement", agentId: "claude-cli" }] });

    sendPipelineRunControl({ changeName: "alpha", runId: "r1", kind: "cancel" }, deps);

    await vi.waitFor(() => expect(received).toEqual([expect.objectContaining({ kind: "cancel", runId: "r1", agentId: "claude-cli" })]));
    expect(resolveRunner).toHaveBeenCalledWith("claude-cli");
  });

  it("sends nothing for a run this host does not hold", () => {
    const { deps, chainRunner, resolveRunner } = setUp({ runs: [] });

    sendPipelineRunControl({ changeName: "alpha", runId: "r1", kind: "confirmCheckpoint" }, deps);

    expect(chainRunner.confirmCheckpoint).not.toHaveBeenCalled();
    expect(resolveRunner).not.toHaveBeenCalled();
  });
});
