import { act, fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import type { Command, Event } from "@openspec-ui/core";
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

describe("AiPanel (direct OpenSpec mode)", () => {
    it("sends a list command with generated runId", () => {
        const { transport, send } = createFakeTransport();
        render(<AiPanel transport={transport} cwd="/repo" changeDir="/repo/openspec/changes/x" generateRunId={() => "run-fixed"} />);

        fireEvent.click(screen.getByTestId("run-button"));

        expect(send).toHaveBeenCalledWith({
            kind: "list",
            cwd: "/repo",
            runId: "run-fixed",
            context: { changeDir: "/repo/openspec/changes", promptContext: undefined },
        } satisfies Command);
    });

    it("shows direct OpenSpec commands and agent commands in command picker", () => {
        const { transport } = createFakeTransport();
        render(<AiPanel transport={transport} cwd="/repo" changeDir="/x" />);

        const picker = screen.getByTestId("command-picker");
        const options = picker.querySelectorAll("option");
        expect(Array.from(options).map((option) => option.textContent)).toEqual([
            "status",
            "list",
            "show",
            "validate",
            "plan",
            "implement",
            "review",
        ]);
    });

    it("defaults the agent picker to the default agent and disables it for direct commands", () => {
        const { transport } = createFakeTransport();
        render(<AiPanel transport={transport} cwd="/repo" changeDir="/x" />);

        const agentPicker = screen.getByTestId("agent-picker") as HTMLSelectElement;
        expect(agentPicker.value).toBe("claude-cli");
        expect(agentPicker).toBeDisabled();
        const options = Array.from(agentPicker.querySelectorAll("option")).map((option) => option.value);
        expect(options).toEqual(["claude-cli", "copilot-cli", "codex-cli", "gemini-cli", "local-llm"]);
    });

    it("enables the agent picker for plan/implement/review and sends the selected agentId", () => {
        const { transport, emit, send } = createFakeTransport();
        render(<AiPanel transport={transport} cwd="/repo" changeDir="/repo/openspec/changes" generateRunId={() => "run-agent"} />);

        fireEvent.click(screen.getByTestId("load-changes-button"));
        emit({
            kind: "stdout",
            runId: "run-agent",
            timestamp: "t",
            chunk: JSON.stringify({ changes: [{ name: "some-change" }] }),
        });
        emit({ kind: "completed", runId: "run-agent", timestamp: "t" });

        fireEvent.change(screen.getByTestId("command-picker"), { target: { value: "implement" } });
        expect(screen.getByTestId("agent-picker")).not.toBeDisabled();

        fireEvent.change(screen.getByTestId("agent-picker"), { target: { value: "gemini-cli" } });
        fireEvent.click(screen.getByTestId("run-button"));

        expect(send).toHaveBeenLastCalledWith({
            kind: "implement",
            cwd: "/repo",
            runId: "run-agent",
            agentId: "gemini-cli",
            context: { changeDir: "/repo/openspec/changes/some-change", promptContext: undefined },
        } satisfies Command);
    });

    it("omits agentId for direct OpenSpec commands regardless of the picker's value", () => {
        const { transport, send } = createFakeTransport();
        render(<AiPanel transport={transport} cwd="/repo" changeDir="/x" generateRunId={() => "run-direct"} />);

        fireEvent.click(screen.getByTestId("run-button"));

        expect(send).toHaveBeenCalledWith(
            expect.not.objectContaining({ agentId: expect.anything() }),
        );
    });

    it("renders events only for the active runId", () => {
        const { transport, emit } = createFakeTransport();
        render(<AiPanel transport={transport} cwd="/repo" changeDir="/x" generateRunId={() => "run-1"} />);

        fireEvent.click(screen.getByTestId("run-button"));
        emit({ kind: "stdout", runId: "run-stale", timestamp: "t", chunk: "ignore" });
        emit({ kind: "stdout", runId: "run-1", timestamp: "t", chunk: "keep" });

        const log = screen.getByTestId("event-log");
        expect(log.querySelectorAll("li")).toHaveLength(1);
        expect(screen.getByTestId("event-0")).toHaveTextContent("keep");
    });

    it("coalesces fragmented stdout chunks into a readable event", () => {
        const { transport, emit } = createFakeTransport();
        render(<AiPanel transport={transport} cwd="/repo" changeDir="/x" generateRunId={() => "run-merge"} />);
        fireEvent.click(screen.getByTestId("run-button"));

        emit({ kind: "stdout", runId: "run-merge", timestamp: "t1", chunk: "The " });
        emit({ kind: "stdout", runId: "run-merge", timestamp: "t2", chunk: "status " });
        emit({ kind: "stdout", runId: "run-merge", timestamp: "t3", chunk: "is ready." });

        expect(screen.getByTestId("event-0")).toHaveTextContent("The status is ready.");
    });

    it("renders OpenSpec status JSON as a dedicated status card", () => {
        const { transport, emit } = createFakeTransport();
        render(<AiPanel transport={transport} cwd="/repo" changeDir="/x" generateRunId={() => "run-status-json"} />);
        fireEvent.click(screen.getByTestId("run-button"));

        emit({
            kind: "stdout",
            runId: "run-status-json",
            timestamp: "t",
            chunk: JSON.stringify({
                changeName: "shared-ui",
                schemaName: "spec-driven",
                progress: { total: 4, complete: 3, remaining: 1 },
                artifacts: [
                    { id: "proposal", outputPath: "proposal.md", status: "done", requires: [] },
                    { id: "tasks", outputPath: "tasks.md", status: "blocked", requires: ["design"] },
                ],
                tasks: [
                    { id: "1", description: "prepare proposal", done: true },
                    { id: "2", description: "finish design", done: false },
                ],
                state: "in_progress",
                instruction: "Complete remaining tasks before archive.",
            }),
        });

        expect(screen.getByTestId("event-0-status")).toBeInTheDocument();
        expect(screen.getByTestId("event-0-status")).toHaveTextContent("shared-ui");
        expect(screen.getByTestId("event-0-status")).toHaveTextContent("Progress: 3/4");
        expect(screen.getByTestId("event-0-status")).toHaveTextContent("blocked");
    });

    it("renders status JSON card even when progress is omitted", () => {
        const { transport, emit } = createFakeTransport();
        render(<AiPanel transport={transport} cwd="/repo" changeDir="/x" generateRunId={() => "run-status-no-progress"} />);
        fireEvent.click(screen.getByTestId("run-button"));

        emit({
            kind: "stdout",
            runId: "run-status-no-progress",
            timestamp: "t",
            chunk: JSON.stringify({
                changeName: "direct-openspec-mode",
                schemaName: "spec-driven",
                isComplete: true,
                nextSteps: ["All planning artifacts are complete; review tasks before implementation."],
                artifacts: [
                    { id: "proposal", outputPath: "proposal.md", status: "done", requires: [] },
                    { id: "tasks", outputPath: "tasks.md", status: "done", requires: ["design"] },
                ],
            }),
        });

        expect(screen.getByTestId("event-0-status")).toBeInTheDocument();
        expect(screen.getByTestId("event-0-status")).toHaveTextContent("direct-openspec-mode");
        expect(screen.getByTestId("event-0-status")).toHaveTextContent("Progress: 2/2");
    });

    it("renders list JSON as a structured changes card", () => {
        const { transport, emit } = createFakeTransport();
        render(<AiPanel transport={transport} cwd="/repo" changeDir="/x" generateRunId={() => "run-list-json"} />);
        fireEvent.click(screen.getByTestId("run-button"));

        emit({
            kind: "stdout",
            runId: "run-list-json",
            timestamp: "t",
            chunk: JSON.stringify({
                changes: [
                    { name: "direct-openspec-mode", completedTasks: 14, totalTasks: 14, status: "complete" },
                    { name: "command-output-hub", completedTasks: 20, totalTasks: 20, status: "complete" },
                ],
            }),
        });

        expect(screen.getByTestId("event-0-list")).toHaveTextContent("OpenSpec Changes");
        expect(screen.getByTestId("event-0-list")).toHaveTextContent("direct-openspec-mode");
    });

    it("renders show JSON as a structured card", () => {
        const { transport, emit } = createFakeTransport();
        render(<AiPanel transport={transport} cwd="/repo" changeDir="/x" generateRunId={() => "run-show"} />);
        fireEvent.click(screen.getByTestId("run-button"));

        emit({
            kind: "stdout",
            runId: "run-show",
            timestamp: "t1",
            chunk: JSON.stringify({
                id: "direct-openspec-mode",
                title: "Direct mode",
                deltaCount: 2,
                deltas: [
                    { spec: "command-output", operation: "add", description: "add command-json endpoint" },
                ],
            }),
        });

        expect(screen.getByTestId("event-0-show")).toHaveTextContent("direct-openspec-mode");
        expect(screen.getByTestId("event-0-show")).toHaveTextContent("2 deltas");
    });

    it("renders validate JSON as a structured card", () => {
        const { transport, emit } = createFakeTransport();
        render(<AiPanel transport={transport} cwd="/repo" changeDir="/x" generateRunId={() => "run-validate"} />);
        fireEvent.click(screen.getByTestId("run-button"));

        emit({
            kind: "stdout",
            runId: "run-validate",
            timestamp: "t2",
            chunk: JSON.stringify({
                items: [
                    { id: "spec-1", type: "spec", valid: true },
                    { id: "spec-2", type: "spec", valid: false },
                ],
                summary: { totals: { items: 2, passed: 1, failed: 1 } },
            }),
        });

        expect(screen.getByTestId("event-0-validate")).toHaveTextContent("1/2 passed");
        expect(screen.getByTestId("event-0-validate")).toHaveTextContent("spec-2");
    });

    it("toggles run button state while status run is in progress", () => {
        const { transport, emit } = createFakeTransport();
        render(<AiPanel transport={transport} cwd="/repo" changeDir="/x" generateRunId={() => "run-1"} />);

        expect(screen.getByTestId("run-button")).not.toBeDisabled();

        fireEvent.click(screen.getByTestId("run-button"));
        expect(screen.getByTestId("run-button")).toBeDisabled();

        emit({ kind: "completed", runId: "run-1", timestamp: "t" });
        expect(screen.getByTestId("run-button")).not.toBeDisabled();
    });

    it("requires loading and selecting change before status command", () => {
        const { transport, emit, send } = createFakeTransport();
        render(<AiPanel transport={transport} cwd="/repo" changeDir="/repo/openspec/changes" generateRunId={() => "run-select"} />);

        fireEvent.change(screen.getByTestId("command-picker"), { target: { value: "status" } });
        expect(screen.getByTestId("run-button")).toBeDisabled();

        fireEvent.click(screen.getByTestId("load-changes-button"));
        emit({
            kind: "stdout",
            runId: "run-select",
            timestamp: "t",
            chunk: JSON.stringify({
                changes: [{ name: "direct-openspec-mode" }],
            }),
        });
        emit({ kind: "completed", runId: "run-select", timestamp: "t" });

        expect(screen.getByTestId("run-button")).not.toBeDisabled();
        fireEvent.click(screen.getByTestId("run-button"));

        expect(send).toHaveBeenLastCalledWith({
            kind: "status",
            cwd: "/repo",
            runId: "run-select",
            context: { changeDir: "/repo/openspec/changes/direct-openspec-mode", promptContext: undefined },
        } satisfies Command);
    });

    it("shows explicit loading and failure status labels", () => {
        const { transport, emit } = createFakeTransport();
        render(<AiPanel transport={transport} cwd="/repo" changeDir="/repo/openspec/changes" generateRunId={() => "run-status-line"} />);

        expect(screen.getByTestId("run-status-label")).toHaveTextContent("Idle");

        fireEvent.click(screen.getByTestId("run-button"));
        expect(screen.getByTestId("run-status-label")).toHaveTextContent("Loading...");

        emit({ kind: "failed", runId: "run-status-line", timestamp: "t", reason: "network down" });
        expect(screen.getByTestId("run-status-label")).toHaveTextContent("Failed: network down");
    });
});
