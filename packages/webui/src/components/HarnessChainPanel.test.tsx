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

  it("ignores events from a different runId", () => {
    const { transport, emit } = createFakeTransport();
    render(<HarnessChainPanel transport={transport} cwd={cwd} changeDir={changeDir} generateRunId={() => "chain-1"} />);
    fireEvent.click(screen.getByTestId("start-chain-button"));

    emit({ kind: "completed", runId: "some-other-run", timestamp: "t1", summary: "not mine" });

    expect(screen.getByTestId("chain-status-label")).toHaveTextContent("Running...");
  });
});
