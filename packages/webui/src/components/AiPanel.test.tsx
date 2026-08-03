import { act, fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import type { Command, Event } from "@openspec-ui/core";
import { AGENT_REGISTRY } from "@openspec-ui/core/browser";
import type { Transport } from "../transport/types.js";
import { AiPanel } from "./AiPanel.js";

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

describe("AiPanel", () => {
  it("sends a Command with the selected agent/command kind and a generated runId", () => {
    const { transport, send } = createFakeTransport();
    render(
      <AiPanel transport={transport} cwd="/repo" changeDir="/repo/openspec/changes/x" generateRunId={() => "run-fixed"} />,
    );

    fireEvent.click(screen.getByTestId("run-button"));

    expect(send).toHaveBeenCalledWith({
      kind: "plan",
      cwd: "/repo",
      runId: "run-fixed",
      agentId: AGENT_REGISTRY[0]!.id,
      context: { changeDir: "/repo/openspec/changes/x", promptContext: undefined },
    } satisfies Command);
  });

  it("renders streamed events for the current run, in order", () => {
    const { transport, emit } = createFakeTransport();
    render(<AiPanel transport={transport} cwd="/repo" changeDir="/x" generateRunId={() => "run-1"} />);
    fireEvent.click(screen.getByTestId("run-button"));

    emit({ kind: "started", runId: "run-1", timestamp: "t", command: "plan", cwd: "/repo" });
    emit({ kind: "stdout", runId: "run-1", timestamp: "t", chunk: "step 1\n" });
    emit({ kind: "completed", runId: "run-1", timestamp: "t", summary: "done" });

    const log = screen.getByTestId("event-log");
    expect(log.querySelectorAll("li")).toHaveLength(3);
    expect(screen.getByTestId("event-0")).toHaveTextContent("started (plan)");
    expect(screen.getByTestId("event-1")).toHaveTextContent("step 1");
    expect(screen.getByTestId("event-2")).toHaveTextContent("completed: done");
  });

  it("ignores events belonging to a different runId", () => {
    const { transport, emit } = createFakeTransport();
    render(<AiPanel transport={transport} cwd="/repo" changeDir="/x" generateRunId={() => "run-current"} />);
    fireEvent.click(screen.getByTestId("run-button"));

    emit({ kind: "stdout", runId: "run-stale", timestamp: "t", chunk: "should be ignored" });

    expect(screen.getByTestId("event-log").querySelectorAll("li")).toHaveLength(0);
  });

  it("disables Run and enables Cancel while a run is in flight, and reverses on completion", () => {
    const { transport, emit } = createFakeTransport();
    render(<AiPanel transport={transport} cwd="/repo" changeDir="/x" generateRunId={() => "run-1"} />);

    expect(screen.getByTestId("run-button")).not.toBeDisabled();
    expect(screen.getByTestId("cancel-button")).toBeDisabled();

    fireEvent.click(screen.getByTestId("run-button"));
    expect(screen.getByTestId("run-button")).toBeDisabled();
    expect(screen.getByTestId("cancel-button")).not.toBeDisabled();

    emit({ kind: "completed", runId: "run-1", timestamp: "t" });
    expect(screen.getByTestId("run-button")).not.toBeDisabled();
    expect(screen.getByTestId("cancel-button")).toBeDisabled();
  });

  it("sends a cancel Command with the same runId when Cancel is clicked", () => {
    const { transport, send } = createFakeTransport();
    render(<AiPanel transport={transport} cwd="/repo" changeDir="/x" generateRunId={() => "run-1"} />);

    fireEvent.click(screen.getByTestId("run-button"));
    fireEvent.click(screen.getByTestId("cancel-button"));

    expect(send).toHaveBeenLastCalledWith(
      expect.objectContaining({ kind: "cancel", runId: "run-1", cwd: "/repo" }),
    );
  });

  it("shows a policy banner when the run fails with a Copilot policy error", () => {
    const { transport, emit } = createFakeTransport();
    render(<AiPanel transport={transport} cwd="/repo" changeDir="/x" generateRunId={() => "run-policy"} />);
    fireEvent.click(screen.getByTestId("run-button"));

    emit({
      kind: "failed",
      runId: "run-policy",
      timestamp: "t",
      reason: "Error: Access denied by policy settings (Request ID: E6DC:...)",
    });

    expect(screen.getByTestId("status-banner")).toHaveTextContent("Copilot CLI is blocked by policy settings");
  });

  it("shows a policy banner for the exact Copilot CLI denial message", () => {
    const { transport, emit } = createFakeTransport();
    render(<AiPanel transport={transport} cwd="/repo" changeDir="/x" generateRunId={() => "run-policy-exact"} />);
    fireEvent.click(screen.getByTestId("run-button"));

    emit({
      kind: "failed",
      runId: "run-policy-exact",
      timestamp: "t",
      reason:
        "Error: Access denied by policy settings (Request ID: E9D3:322C95:74EAB40:89A40B6:6A70A29B) Your Copilot CLI policy setting may be preventing access. This can happen when: Your organization has restricted Copilot access. Your Copilot subscription does not include this feature. Required policies have not been enabled by your administrator.",
    });

    expect(screen.getByTestId("status-banner")).toBeInTheDocument();
    expect(screen.getByTestId("status-banner")).toHaveTextContent("Open Copilot settings");
    expect(screen.getByTestId("event-0")).toHaveTextContent("failed: Copilot CLI is blocked by policy settings");
    expect(screen.getByTestId("event-0")).not.toHaveTextContent("Access denied by policy settings");
  });

  it("clears the policy banner on the next run", () => {
    const { transport, emit } = createFakeTransport();
    render(<AiPanel transport={transport} cwd="/repo" changeDir="/x" generateRunId={() => "run-policy"} />);
    fireEvent.click(screen.getByTestId("run-button"));

    emit({ kind: "failed", runId: "run-policy", timestamp: "t", reason: "Access denied by policy settings" });
    expect(screen.getByTestId("status-banner")).toBeInTheDocument();

    fireEvent.click(screen.getByTestId("run-button"));
    expect(screen.queryByTestId("status-banner")).toBeNull();
  });

  it("unsubscribes from the transport on unmount", () => {
    const unsubscribe = vi.fn();
    const transport: Transport = { send: vi.fn(), subscribe: () => unsubscribe };
    const { unmount } = render(<AiPanel transport={transport} cwd="/repo" changeDir="/x" />);
    unmount();
    expect(unsubscribe).toHaveBeenCalled();
  });
});
