import { act, fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import type { Command, Event } from "@openspec-ui/core";
import type { Transport } from "../transport/types.js";
import { HarnessChainPanel } from "./HarnessChainPanel.js";

function createFakeTransport() {
  let listener: ((event: Event) => void) | null = null;
  const send = vi.fn();
  const transport: Transport = {
    send,
    subscribe: (onEvent) => {
      listener = onEvent;
      return () => {
        listener = null;
      };
    },
  };
  return {
    transport,
    send,
    emit: (event: Event) => {
      act(() => {
        listener?.(event);
      });
    },
  };
}

const cwd = "/repo";
const changeDir = "/repo/openspec/changes/demo";

describe("HarnessChainPanel", () => {
  it("sends a chain command with a generated runId on start", () => {
    const { transport, send } = createFakeTransport();
    render(<HarnessChainPanel transport={transport} cwd={cwd} changeDir={changeDir} generateRunId={() => "chain-1"} />);

    fireEvent.click(screen.getByTestId("start-chain-button"));

    expect(send).toHaveBeenCalledWith({
      kind: "chain",
      cwd,
      runId: "chain-1",
      context: { changeDir },
    } satisfies Command);
    expect(screen.getByTestId("chain-status-label")).toHaveTextContent("Running...");
  });

  it("renders a checkpoint as an explicit continue/cancel choice", () => {
    const { transport, emit } = createFakeTransport();
    render(<HarnessChainPanel transport={transport} cwd={cwd} changeDir={changeDir} generateRunId={() => "chain-1"} />);
    fireEvent.click(screen.getByTestId("start-chain-button"));

    emit({ kind: "started", runId: "chain-1", timestamp: "t1", command: "chain", cwd });
    emit({ kind: "checkpoint", runId: "chain-1", timestamp: "t2", stage: "propose", nextStage: "review", nextAgentId: "claude-cli" });

    expect(screen.getByTestId("checkpoint-confirmation")).toHaveTextContent("Continue to review with claude-cli?");
    expect(screen.getByTestId("chain-status-label")).toHaveTextContent("Paused at checkpoint");
    // No plain "Cancel" button while paused — cancel is offered inside the checkpoint choice instead.
    expect(screen.queryByTestId("cancel-chain-button")).not.toBeInTheDocument();
  });

  it("confirming a checkpoint sends confirmCheckpoint for the active runId", () => {
    const { transport, send, emit } = createFakeTransport();
    render(<HarnessChainPanel transport={transport} cwd={cwd} changeDir={changeDir} generateRunId={() => "chain-1"} />);
    fireEvent.click(screen.getByTestId("start-chain-button"));
    emit({ kind: "checkpoint", runId: "chain-1", timestamp: "t2", stage: "propose", nextStage: "review", nextAgentId: "claude-cli" });

    fireEvent.click(screen.getByTestId("confirm-checkpoint-button"));

    expect(send).toHaveBeenCalledWith({
      kind: "confirmCheckpoint",
      cwd,
      runId: "chain-1",
      context: { changeDir },
    } satisfies Command);
  });

  it("cancelling from a checkpoint sends cancel for the active runId", () => {
    const { transport, send, emit } = createFakeTransport();
    render(<HarnessChainPanel transport={transport} cwd={cwd} changeDir={changeDir} generateRunId={() => "chain-1"} />);
    fireEvent.click(screen.getByTestId("start-chain-button"));
    emit({ kind: "checkpoint", runId: "chain-1", timestamp: "t2", stage: "propose", nextStage: "review", nextAgentId: "claude-cli" });

    fireEvent.click(screen.getByTestId("cancel-checkpoint-button"));

    expect(send).toHaveBeenCalledWith({
      kind: "cancel",
      cwd,
      runId: "chain-1",
      context: { changeDir },
    } satisfies Command);
  });

  it("cancelling mid-run (no pending checkpoint) sends cancel for the active runId", () => {
    const { transport, send, emit } = createFakeTransport();
    render(<HarnessChainPanel transport={transport} cwd={cwd} changeDir={changeDir} generateRunId={() => "chain-1"} />);
    fireEvent.click(screen.getByTestId("start-chain-button"));
    emit({ kind: "started", runId: "chain-1", timestamp: "t1", command: "chain", cwd });

    fireEvent.click(screen.getByTestId("cancel-chain-button"));

    expect(send).toHaveBeenCalledWith({
      kind: "cancel",
      cwd,
      runId: "chain-1",
      context: { changeDir },
    } satisfies Command);
  });

  it("keeps the Cancel control, and can be pressed again, while a cancellation has not taken effect", () => {
    const { transport, send, emit } = createFakeTransport();
    render(<HarnessChainPanel transport={transport} cwd={cwd} changeDir={changeDir} generateRunId={() => "chain-1"} />);
    fireEvent.click(screen.getByTestId("start-chain-button"));
    emit({ kind: "started", runId: "chain-1", timestamp: "t1", command: "chain", cwd });

    fireEvent.click(screen.getByTestId("cancel-chain-button"));
    emit({ kind: "cancelling", runId: "chain-1", timestamp: "t2", attempted: "termination-requested" });
    // The agent keeps working, which is the whole scenario reported on
    // 2026-09-03: the panel used to call the run finished here and remove
    // the only control, leaving nothing to press while files kept
    // changing.
    emit({ kind: "stdout", runId: "chain-1", timestamp: "t3", chunk: "still editing files\n" });

    expect(screen.getByTestId("chain-status-label").textContent).toBe("Cancelling...");
    expect(screen.getByTestId("cancel-chain-button")).toBeTruthy();

    fireEvent.click(screen.getByTestId("cancel-chain-button"));
    expect(send).toHaveBeenCalledTimes(3); // chain, cancel, cancel again
  });

  it("withdraws the Cancel control once the run has actually ended", () => {
    const { transport, emit } = createFakeTransport();
    render(<HarnessChainPanel transport={transport} cwd={cwd} changeDir={changeDir} generateRunId={() => "chain-1"} />);
    fireEvent.click(screen.getByTestId("start-chain-button"));
    emit({ kind: "started", runId: "chain-1", timestamp: "t1", command: "chain", cwd });
    emit({ kind: "cancelling", runId: "chain-1", timestamp: "t2", attempted: "termination-requested" });
    emit({ kind: "cancelled", runId: "chain-1", timestamp: "t3" });

    expect(screen.getByTestId("chain-status-label").textContent).toBe("Cancelled");
    expect(screen.queryByTestId("cancel-chain-button")).toBeNull();
  });

  it("shows a completed summary and re-enables starting a new chain", () => {
    const { transport, emit } = createFakeTransport();
    render(<HarnessChainPanel transport={transport} cwd={cwd} changeDir={changeDir} generateRunId={() => "chain-1"} />);
    fireEvent.click(screen.getByTestId("start-chain-button"));

    emit({ kind: "completed", runId: "chain-1", timestamp: "t3", summary: "archived demo" });

    expect(screen.getByTestId("chain-status-label")).toHaveTextContent("Completed: archived demo");
    expect(screen.getByTestId("start-chain-button")).not.toBeDisabled();
  });

  it("renders a permission request with Allow/Deny, and answers with the request's own id", () => {
    const { transport, send, emit } = createFakeTransport();
    render(<HarnessChainPanel transport={transport} cwd={cwd} changeDir={changeDir} generateRunId={() => "chain-1"} />);
    fireEvent.click(screen.getByTestId("start-chain-button"));
    emit({ kind: "started", runId: "chain-1", timestamp: "t1", command: "chain", cwd });
    emit({ kind: "permissionRequest", runId: "chain-1", timestamp: "t2", requestId: "req-1", description: "run rm -rf" });

    expect(screen.getByTestId("permission-request")).toHaveTextContent("run rm -rf");

    fireEvent.click(screen.getByTestId("allow-permission-button"));

    expect(send).toHaveBeenCalledWith({
      kind: "resolvePermission",
      cwd,
      runId: "chain-1",
      context: { changeDir },
      permissionRequestId: "req-1",
      permissionOutcome: "allow",
    } satisfies Command);
    // Answered — the control does not offer the same request again.
    expect(screen.queryByTestId("permission-request")).not.toBeInTheDocument();
  });

  it("shows the reason when a chain is cancelled by a time ceiling", () => {
    const { transport, emit } = createFakeTransport();
    render(<HarnessChainPanel transport={transport} cwd={cwd} changeDir={changeDir} generateRunId={() => "chain-1"} />);
    fireEvent.click(screen.getByTestId("start-chain-button"));

    emit({
      kind: "cancelled",
      runId: "chain-1",
      timestamp: "t1",
      reason: 'stopped "apply" at the stage time limit: timeout.maxStageSeconds is 5s',
    });

    expect(screen.getByTestId("chain-event-0")).toHaveTextContent("timeout.maxStageSeconds is 5s");
  });

  it("answers a second, later permission request with its own id, not the first's", () => {
    // Replaces the original task 5.5 ("a test that would pass if it used
    // the watched run id must fail"), which design.md found unfalsifiable
    // — a stage runs under the chain's own runId, so there is no differing
    // id to catch a wrong answer. This is the test that does bite: two
    // distinct requestIds must never be confused with each other.
    const { transport, send, emit } = createFakeTransport();
    render(<HarnessChainPanel transport={transport} cwd={cwd} changeDir={changeDir} generateRunId={() => "chain-1"} />);
    fireEvent.click(screen.getByTestId("start-chain-button"));
    emit({ kind: "started", runId: "chain-1", timestamp: "t1", command: "chain", cwd });
    emit({ kind: "permissionRequest", runId: "chain-1", timestamp: "t2", requestId: "req-1", description: "first request" });
    fireEvent.click(screen.getByTestId("deny-permission-button"));
    emit({ kind: "permissionRequest", runId: "chain-1", timestamp: "t3", requestId: "req-2", description: "second request" });

    expect(screen.getByTestId("permission-request")).toHaveTextContent("second request");
    fireEvent.click(screen.getByTestId("allow-permission-button"));

    expect(send).toHaveBeenLastCalledWith({
      kind: "resolvePermission",
      cwd,
      runId: "chain-1",
      context: { changeDir },
      permissionRequestId: "req-2",
      permissionOutcome: "allow",
    } satisfies Command);
  });

  it("ignores events from a different runId", () => {
    const { transport, emit } = createFakeTransport();
    render(<HarnessChainPanel transport={transport} cwd={cwd} changeDir={changeDir} generateRunId={() => "chain-1"} />);
    fireEvent.click(screen.getByTestId("start-chain-button"));

    emit({ kind: "completed", runId: "some-other-run", timestamp: "t1", summary: "not mine" });

    expect(screen.getByTestId("chain-status-label")).toHaveTextContent("Running...");
  });
});

describe("HarnessChainPanel — usage while it runs (usage-visible-while-running)", () => {
  function startChain(budget?: { maxCostUsd?: number; maxTokens?: number }) {
    const fake = createFakeTransport();
    render(
      <HarnessChainPanel
        transport={fake.transport}
        cwd={cwd}
        changeDir={changeDir}
        generateRunId={() => "chain-1"}
        budget={budget}
      />,
    );
    fireEvent.click(screen.getByTestId("start-chain-button"));
    return fake;
  }

  const base = { runId: "chain-1", timestamp: "t" };

  it("shows nothing at all before a stage has been announced", () => {
    startChain();
    expect(screen.queryByTestId("usage-summary")).toBeNull();
  });

  it("attributes a stage's reported usage to that stage, and totals it", () => {
    const { emit } = startChain();

    emit({ ...base, kind: "stageStarted", stage: "propose", agentId: "claude-cli-acp" } as Event);
    emit({ ...base, kind: "usageReported", usage: { inputTokens: 500, outputTokens: 120, costUsd: 0.4 } } as Event);
    emit({ ...base, kind: "stageStarted", stage: "apply", agentId: "claude-cli-acp" } as Event);
    emit({ ...base, kind: "usageReported", usage: { inputTokens: 1500, outputTokens: 400, costUsd: 1.1 } } as Event);

    expect(screen.getByTestId("usage-stage-propose").textContent).toContain("$0.40");
    expect(screen.getByTestId("usage-stage-apply").textContent).toContain("$1.10");
    expect(screen.getByTestId("usage-total").textContent).toContain("$1.50");
    // Built through toLocaleString, so the separator is the environment's,
    // not a hard-coded comma — asserting "2,000" would pass only where the
    // test runner happens to run in an en-US locale.
    expect(screen.getByTestId("usage-total").textContent).toContain(`${(2000).toLocaleString()} in`);
  });

  it("names the stage a chain failed during — the case a stage boundary never covers", () => {
    const { emit } = startChain();

    emit({ ...base, kind: "stageStarted", stage: "propose", agentId: "claude-cli-acp" } as Event);
    emit({ ...base, kind: "stageStarted", stage: "apply", agentId: "claude-cli-acp" } as Event);
    emit({ ...base, kind: "usageReported", usage: { costUsd: 4 } } as Event);
    emit({ ...base, kind: "failed", reason: "agent crashed" } as Event);

    const failedStage = screen.getByTestId("usage-stage-apply");
    expect(failedStage.dataset.state).toBe("failed");
    expect(failedStage.textContent).toContain("$4.00");
    expect(screen.getByTestId("usage-stage-propose").dataset.state).toBe("completed");
  });

  it("says a stage reported nothing rather than showing it as free", () => {
    const { emit } = startChain();

    emit({ ...base, kind: "stageStarted", stage: "propose", agentId: "claude-cli" } as Event);
    emit({ ...base, kind: "stageStarted", stage: "apply", agentId: "claude-cli-acp" } as Event);
    emit({ ...base, kind: "usageReported", usage: { costUsd: 2 } } as Event);

    const silent = screen.getByTestId("usage-stage-propose").textContent ?? "";
    expect(silent).toContain("not reported");
    expect(silent).not.toContain("$0.00");
  });

  it("shows a live usage_update as the agent's own running report, not as a total", () => {
    const { emit } = startChain();

    emit({ ...base, kind: "stageStarted", stage: "apply", agentId: "copilot-cli-acp" } as Event);
    emit({
      ...base,
      kind: "agentUpdate",
      update: { sessionUpdate: "usage_update", used: 90000, size: 200000, cost: { amount: 0.44, currency: "USD" } },
    } as Event);

    expect(screen.getByTestId("usage-live-apply").textContent).toContain("$0.44 so far");
    expect(screen.getByTestId("usage-live-apply").textContent).toContain(
      `context ${(90000).toLocaleString()} / ${(200000).toLocaleString()}`,
    );
    // Nothing has settled, so the run has still reported nothing that a
    // ceiling could act on.
    expect(screen.getByTestId("usage-total").textContent).toContain("nothing reported");
  });

  it("shows a configured ceiling beside the recorded total, and says what reaching it does", () => {
    const { emit } = startChain({ maxCostUsd: 25 });

    emit({ ...base, kind: "stageStarted", stage: "apply", agentId: "claude-cli-acp" } as Event);
    emit({ ...base, kind: "usageReported", usage: { costUsd: 3.4 } } as Event);

    const ceiling = screen.getByTestId("usage-budget").textContent ?? "";
    expect(ceiling).toContain("$3.40 of $25.00");
    expect(ceiling).toContain("does not interrupt the stage");
  });

  it("says nothing about a ceiling when none is configured", () => {
    const { emit } = startChain();

    emit({ ...base, kind: "stageStarted", stage: "apply", agentId: "claude-cli-acp" } as Event);
    emit({ ...base, kind: "usageReported", usage: { costUsd: 3.4 } } as Event);

    expect(screen.queryByTestId("usage-budget")).toBeNull();
  });

  it("says outright when no agent in the run reports usage at all", () => {
    const { emit } = startChain();

    emit({ ...base, kind: "stageStarted", stage: "apply", agentId: "claude-cli" } as Event);

    // A panel that simply never moves is indistinguishable from a broken
    // one — `claude-cli` reports nothing, and that has to be said.
    expect(screen.getByTestId("usage-none-note").textContent).toContain("has reported what it spent");
  });
});


describe("HarnessChainPanel — the button says what it does (two-buttons-two-names)", () => {
  it("names the button for starting a chain, not for entering the harness", () => {
    // Asserted by accessible name, not by test id. The test id was
    // already `start-chain-button` while the label read "Run with
    // Agentic Harness" — the same words as the dispatch entry rendered
    // directly above it in the standalone UI, so a test on the id would
    // have passed throughout.
    render(<HarnessChainPanel transport={createFakeTransport().transport} cwd={cwd} changeDir={changeDir} />);

    expect(screen.getByRole("button", { name: "Start chain" })).toBeTruthy();
    expect(screen.queryByRole("button", { name: "Run with Agentic Harness" })).toBeNull();
  });
});
