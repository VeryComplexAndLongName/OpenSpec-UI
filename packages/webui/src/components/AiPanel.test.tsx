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

    it("shows direct OpenSpec commands in command picker", () => {
        const { transport } = createFakeTransport();
        render(<AiPanel transport={transport} cwd="/repo" changeDir="/x" />);

        const picker = screen.getByTestId("command-picker");
        const options = picker.querySelectorAll("option");
        expect(options).toHaveLength(4);
        expect(Array.from(options).map((option) => option.textContent)).toEqual([
            "status",
            "list",
            "show",
            "validate",
        ]);
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
});
