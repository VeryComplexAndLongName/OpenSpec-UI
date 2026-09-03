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

    it("starts on the change it was opened for, and on the seeded command kind", () => {
        const { transport } = createFakeTransport();
        render(
            <AiPanel
                transport={transport}
                cwd="/repo"
                changeDir="/repo/openspec/changes/demo"
                initialCommandKind="implement"
            />,
        );

        // Before any `list` has loaded. Right-clicking a change and
        // choosing Run with Agentic Harness used to open a panel with
        // none of this filled in, so the user re-entered what they had
        // just said by right-clicking.
        expect((screen.getByTestId("command-picker") as HTMLSelectElement).value).toBe("implement");
        expect((screen.getByTestId("change-picker") as HTMLSelectElement).value).toBe("demo");
    });

    it("selects the configured agent for the seeded stage, without being told the agent", () => {
        const { transport } = createFakeTransport();
        render(
            <AiPanel
                transport={transport}
                cwd="/repo"
                changeDir="/repo/openspec/changes/demo"
                initialCommandKind="implement"
                stepAgents={{ apply: "copilot-cli" }}
            />,
        );

        // Nothing here selects the agent directly: the existing effect
        // maps `implement` to the `apply` stage and reads `stepAgents`.
        // With the kind stuck at `list` that mapping produced no stage,
        // which is the whole reason the configured agent never appeared.
        expect((screen.getByTestId("agent-picker") as HTMLSelectElement).value).toBe("copilot-cli");
    });

    it("keeps the previous defaults when no seed is given", () => {
        const { transport } = createFakeTransport();
        render(<AiPanel transport={transport} cwd="/repo" changeDir="/repo/openspec/changes/demo" />);

        // Every other entry point opens the panel without naming a run.
        expect((screen.getByTestId("command-picker") as HTMLSelectElement).value).toBe("list");
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
        expect(options).toEqual([
            "claude-cli",
            "copilot-cli",
            "codex-cli",
            "gemini-cli",
            "local-llm",
            "copilot-cli-acp",
            "gemini-cli-acp",
            "codex-cli-acp",
            "claude-cli-acp",
        ]);
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

    it("annotates agent options with detection results without removing any option", () => {
        const { transport } = createFakeTransport();
        render(
            <AiPanel
                transport={transport}
                cwd="/repo"
                changeDir="/x"
                detectedAgents={{ "claude-cli": true, "copilot-cli": false }}
            />,
        );

        const agentPicker = screen.getByTestId("agent-picker") as HTMLSelectElement;
        const options = Array.from(agentPicker.querySelectorAll("option"));
        expect(options.map((option) => option.value)).toEqual([
            "claude-cli",
            "copilot-cli",
            "codex-cli",
            "gemini-cli",
            "local-llm",
            "copilot-cli-acp",
            "gemini-cli-acp",
            "codex-cli-acp",
            "claude-cli-acp",
        ]);
        expect(options.find((o) => o.value === "claude-cli")?.textContent).toContain("(detected)");
        expect(options.find((o) => o.value === "copilot-cli")?.textContent).toContain("(not detected)");
        // Ids absent from detectedAgents (still loading, or no result yet) get no suffix.
        expect(options.find((o) => o.value === "codex-cli")?.textContent).not.toContain("detected");
    });

    it("shows a Refresh agents button only when onRefreshAgents is supplied", () => {
        const { transport } = createFakeTransport();
        const onRefreshAgents = vi.fn();
        const { rerender } = render(<AiPanel transport={transport} cwd="/repo" changeDir="/x" />);

        expect(screen.queryByTestId("refresh-agents-button")).not.toBeInTheDocument();

        rerender(<AiPanel transport={transport} cwd="/repo" changeDir="/x" onRefreshAgents={onRefreshAgents} />);
        fireEvent.click(screen.getByTestId("refresh-agents-button"));

        expect(onRefreshAgents).toHaveBeenCalledTimes(1);
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

    it("renders an agentUpdate event's text content when present (agent_message_chunk-shaped)", () => {
        const { transport, emit } = createFakeTransport();
        render(<AiPanel transport={transport} cwd="/repo" changeDir="/x" generateRunId={() => "run-au-1"} />);
        fireEvent.click(screen.getByTestId("run-button"));

        emit({
            kind: "agentUpdate",
            runId: "run-au-1",
            timestamp: "t",
            update: { sessionUpdate: "agent_message_chunk", content: { type: "text", text: "hello there" } },
        });

        expect(screen.getByTestId("event-0")).toHaveTextContent("hello there");
    });

    it("falls back to a one-line summary for an agentUpdate event with no text content (e.g. a tool_call)", () => {
        const { transport, emit } = createFakeTransport();
        render(<AiPanel transport={transport} cwd="/repo" changeDir="/x" generateRunId={() => "run-au-2"} />);
        fireEvent.click(screen.getByTestId("run-button"));

        emit({
            kind: "agentUpdate",
            runId: "run-au-2",
            timestamp: "t",
            update: { sessionUpdate: "tool_call", toolCallId: "tool-1" },
        });

        expect(screen.getByTestId("event-0")).toHaveTextContent("agent update: tool_call");
    });

    it("shows an Allow/Deny control for a permissionRequest, sends resolvePermission on click, and hides afterward", () => {
        const { transport, emit, send } = createFakeTransport();
        render(<AiPanel transport={transport} cwd="/repo" changeDir="/x" generateRunId={() => "run-perm-1"} />);
        fireEvent.click(screen.getByTestId("run-button"));

        expect(screen.queryByTestId("permission-request")).not.toBeInTheDocument();

        emit({
            kind: "permissionRequest",
            runId: "run-perm-1",
            timestamp: "t",
            requestId: "perm-1",
            description: "Write to src/index.ts",
        });

        expect(screen.getByTestId("permission-request")).toHaveTextContent("Write to src/index.ts");

        fireEvent.click(screen.getByTestId("allow-permission-button"));

        expect(send).toHaveBeenLastCalledWith({
            kind: "resolvePermission",
            cwd: "/repo",
            runId: "run-perm-1",
            context: { changeDir: "/x", promptContext: undefined },
            permissionRequestId: "perm-1",
            permissionOutcome: "allow",
        } satisfies Command);
        expect(screen.queryByTestId("permission-request")).not.toBeInTheDocument();
    });

    it("sends resolvePermission with outcome deny when Deny is clicked", () => {
        const { transport, emit, send } = createFakeTransport();
        render(<AiPanel transport={transport} cwd="/repo" changeDir="/x" generateRunId={() => "run-perm-2"} />);
        fireEvent.click(screen.getByTestId("run-button"));

        emit({
            kind: "permissionRequest",
            runId: "run-perm-2",
            timestamp: "t",
            requestId: "perm-2",
            description: "Run rm -rf build/",
        });
        fireEvent.click(screen.getByTestId("deny-permission-button"));

        expect(send).toHaveBeenLastCalledWith(
            expect.objectContaining({ kind: "resolvePermission", permissionRequestId: "perm-2", permissionOutcome: "deny" }),
        );
    });

    it("claude-cli-acp's picker entry states it provides progress detail only, no permission gating", () => {
        const { transport } = createFakeTransport();
        render(<AiPanel transport={transport} cwd="/repo" changeDir="/x" />);

        const agentPicker = screen.getByTestId("agent-picker") as HTMLSelectElement;
        const claudeAcpOption = Array.from(agentPicker.querySelectorAll("option")).find(
            (option) => option.value === "claude-cli-acp",
        );
        expect(claudeAcpOption?.textContent?.toLowerCase()).toContain("no permission gate");
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

    it("renders a status JSON card with no progress figure when progress is omitted", () => {
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
        // No "2/2" derived from the two "done" artifacts: an artifact being
        // done means its file exists, which says nothing about tasks.
        expect(screen.getByTestId("event-0-status")).not.toHaveTextContent("Progress:");
        expect(screen.queryByRole("progressbar")).not.toBeInTheDocument();
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
        // No cwd yet, so the panel does not auto-load changes and the
        // idle -> running -> idle transition is observable on its own.
        render(<AiPanel transport={transport} cwd="" changeDir="/x" generateRunId={() => "run-1"} />);

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
        // No cwd yet, so the panel does not auto-load changes and the run
        // starts from the "Idle" label this test is about.
        render(<AiPanel transport={transport} cwd="" changeDir="/repo/openspec/changes" generateRunId={() => "run-status-line"} />);

        expect(screen.getByTestId("run-status-label")).toHaveTextContent("Idle");

        fireEvent.click(screen.getByTestId("run-button"));
        expect(screen.getByTestId("run-status-label")).toHaveTextContent("Loading...");

        emit({ kind: "failed", runId: "run-status-line", timestamp: "t", reason: "network down" });
        expect(screen.getByTestId("run-status-label")).toHaveTextContent("Failed: network down");
    });
});

describe("AiPanel Agentic Harness stepAgents pre-fill", () => {
    it("pre-selects the recommended agent for the current command kind", () => {
        const { transport } = createFakeTransport();
        render(
            <AiPanel
                transport={transport}
                cwd="/repo"
                changeDir="/x"
                stepAgents={{ apply: "gemini-cli" }}
            />,
        );

        fireEvent.change(screen.getByTestId("command-picker"), { target: { value: "implement" } });

        expect((screen.getByTestId("agent-picker") as HTMLSelectElement).value).toBe("gemini-cli");
    });

    it("never overwrites an agent the user picked manually for that command kind", () => {
        const { transport } = createFakeTransport();
        render(
            <AiPanel
                transport={transport}
                cwd="/repo"
                changeDir="/x"
                stepAgents={{ apply: "gemini-cli" }}
            />,
        );

        fireEvent.change(screen.getByTestId("command-picker"), { target: { value: "implement" } });
        fireEvent.change(screen.getByTestId("agent-picker"), { target: { value: "codex-cli" } });
        // Switch away and back to "implement" — the manual pick must stick.
        fireEvent.change(screen.getByTestId("command-picker"), { target: { value: "plan" } });
        fireEvent.change(screen.getByTestId("command-picker"), { target: { value: "implement" } });

        expect((screen.getByTestId("agent-picker") as HTMLSelectElement).value).toBe("codex-cli");
    });

    it("falls back to the default agent when no recommendation exists for the command kind", () => {
        const { transport } = createFakeTransport();
        render(
            <AiPanel
                transport={transport}
                cwd="/repo"
                changeDir="/x"
                stepAgents={{ apply: "gemini-cli" }}
            />,
        );

        fireEvent.change(screen.getByTestId("command-picker"), { target: { value: "review" } });

        expect((screen.getByTestId("agent-picker") as HTMLSelectElement).value).toBe("claude-cli");
    });

    it("behaves exactly as before when no stepAgents prop is supplied", () => {
        const { transport } = createFakeTransport();
        render(<AiPanel transport={transport} cwd="/repo" changeDir="/x" />);

        fireEvent.change(screen.getByTestId("command-picker"), { target: { value: "implement" } });

        expect((screen.getByTestId("agent-picker") as HTMLSelectElement).value).toBe("claude-cli");
    });

    it("sends model on the command when the selected agent matches the stage's configured agent", () => {
        const { transport, emit, send } = createFakeTransport();
        render(
            <AiPanel
                transport={transport}
                cwd="/repo"
                changeDir="/repo/openspec/changes"
                generateRunId={() => "run-model"}
                stepAgents={{ apply: { agent: "claude-cli", model: "claude-3-opus" } }}
            />,
        );

        fireEvent.click(screen.getByTestId("load-changes-button"));
        emit({
            kind: "stdout",
            runId: "run-model",
            timestamp: "t",
            chunk: JSON.stringify({ changes: [{ name: "some-change" }] }),
        });
        emit({ kind: "completed", runId: "run-model", timestamp: "t" });

        fireEvent.change(screen.getByTestId("command-picker"), { target: { value: "implement" } });
        fireEvent.click(screen.getByTestId("run-button"));

        expect(send).toHaveBeenLastCalledWith({
            kind: "implement",
            cwd: "/repo",
            runId: "run-model",
            agentId: "claude-cli",
            model: "claude-3-opus",
            context: { changeDir: "/repo/openspec/changes/some-change", promptContext: undefined },
        } satisfies Command);
    });

    it("sends effort and budget on the command when the selected agent matches the stage's configured agent", () => {
        const { transport, emit, send } = createFakeTransport();
        render(
            <AiPanel
                transport={transport}
                cwd="/repo"
                changeDir="/repo/openspec/changes"
                generateRunId={() => "run-effort-budget"}
                stepAgents={{ apply: { agent: "claude-cli", effort: "high", budget: { maxCostUsd: 5 } } }}
            />,
        );

        fireEvent.click(screen.getByTestId("load-changes-button"));
        emit({
            kind: "stdout",
            runId: "run-effort-budget",
            timestamp: "t",
            chunk: JSON.stringify({ changes: [{ name: "some-change" }] }),
        });
        emit({ kind: "completed", runId: "run-effort-budget", timestamp: "t" });

        fireEvent.change(screen.getByTestId("command-picker"), { target: { value: "implement" } });
        fireEvent.click(screen.getByTestId("run-button"));

        expect(send).toHaveBeenLastCalledWith({
            kind: "implement",
            cwd: "/repo",
            runId: "run-effort-budget",
            agentId: "claude-cli",
            effort: "high",
            budget: { maxCostUsd: 5 },
            context: { changeDir: "/repo/openspec/changes/some-change", promptContext: undefined },
        } satisfies Command);
    });

    it("omits effort and budget from the command when the user picks a different agent than configured", () => {
        const { transport, emit, send } = createFakeTransport();
        render(
            <AiPanel
                transport={transport}
                cwd="/repo"
                changeDir="/repo/openspec/changes"
                generateRunId={() => "run-effort-budget-override"}
                stepAgents={{ apply: { agent: "claude-cli", effort: "high", budget: { maxCostUsd: 5 } } }}
            />,
        );

        fireEvent.click(screen.getByTestId("load-changes-button"));
        emit({
            kind: "stdout",
            runId: "run-effort-budget-override",
            timestamp: "t",
            chunk: JSON.stringify({ changes: [{ name: "some-change" }] }),
        });
        emit({ kind: "completed", runId: "run-effort-budget-override", timestamp: "t" });

        fireEvent.change(screen.getByTestId("command-picker"), { target: { value: "implement" } });
        fireEvent.change(screen.getByTestId("agent-picker"), { target: { value: "gemini-cli" } });
        fireEvent.click(screen.getByTestId("run-button"));

        expect(send).toHaveBeenLastCalledWith({
            kind: "implement",
            cwd: "/repo",
            runId: "run-effort-budget-override",
            agentId: "gemini-cli",
            context: { changeDir: "/repo/openspec/changes/some-change", promptContext: undefined },
        } satisfies Command);
    });

    it("omits model from the command when the user picks a different agent than configured", () => {
        const { transport, emit, send } = createFakeTransport();
        render(
            <AiPanel
                transport={transport}
                cwd="/repo"
                changeDir="/repo/openspec/changes"
                generateRunId={() => "run-agent-override"}
                stepAgents={{ apply: { agent: "claude-cli", model: "claude-3-opus" } }}
            />,
        );

        fireEvent.click(screen.getByTestId("load-changes-button"));
        emit({
            kind: "stdout",
            runId: "run-agent-override",
            timestamp: "t",
            chunk: JSON.stringify({ changes: [{ name: "some-change" }] }),
        });
        emit({ kind: "completed", runId: "run-agent-override", timestamp: "t" });

        fireEvent.change(screen.getByTestId("command-picker"), { target: { value: "implement" } });
        fireEvent.change(screen.getByTestId("agent-picker"), { target: { value: "gemini-cli" } });
        fireEvent.click(screen.getByTestId("run-button"));

        expect(send).toHaveBeenLastCalledWith({
            kind: "implement",
            cwd: "/repo",
            runId: "run-agent-override",
            agentId: "gemini-cli",
            context: { changeDir: "/repo/openspec/changes/some-change", promptContext: undefined },
        } satisfies Command);
    });

    it("never sends model for direct OpenSpec commands even when configured", () => {
        const { transport, emit, send } = createFakeTransport();
        render(
            <AiPanel
                transport={transport}
                cwd="/repo"
                changeDir="/repo/openspec/changes"
                generateRunId={() => "run-direct-cmds"}
                stepAgents={{ apply: { agent: "claude-cli", model: "claude-3-opus" } }}
            />,
        );

        fireEvent.click(screen.getByTestId("load-changes-button"));
        emit({
            kind: "stdout",
            runId: "run-direct-cmds",
            timestamp: "t",
            chunk: JSON.stringify({ changes: [{ name: "some-change" }] }),
        });
        emit({ kind: "completed", runId: "run-direct-cmds", timestamp: "t" });

        // Test "list" — no harness stage
        fireEvent.click(screen.getByTestId("load-changes-button"));
        expect(send).toHaveBeenLastCalledWith(
            expect.not.objectContaining({ model: expect.anything() }),
        );

        // Test "validate" — no harness stage
        fireEvent.change(screen.getByTestId("command-picker"), { target: { value: "validate" } });
        fireEvent.click(screen.getByTestId("run-button"));
        expect(send).toHaveBeenLastCalledWith(
            expect.not.objectContaining({ model: expect.anything() }),
        );
    });
});

describe("AiPanel auto-loads the change list", () => {
    it("sends exactly one list command on open, with no click", () => {
        const { transport, send } = createFakeTransport();
        render(<AiPanel transport={transport} cwd="/repo" changeDir="/repo/openspec/changes" generateRunId={() => "run-auto"} />);

        expect(send).toHaveBeenCalledTimes(1);
        expect(send).toHaveBeenCalledWith({
            kind: "list",
            cwd: "/repo",
            runId: "run-auto",
            context: { changeDir: "/repo/openspec/changes", promptContext: undefined },
        } satisfies Command);
    });

    it("waits for a usable cwd before auto-loading", () => {
        const { transport, send } = createFakeTransport();
        const { rerender } = render(<AiPanel transport={transport} cwd="" changeDir="/repo/openspec/changes" generateRunId={() => "run-auto"} />);

        expect(send).not.toHaveBeenCalled();

        rerender(<AiPanel transport={transport} cwd="/repo" changeDir="/repo/openspec/changes" generateRunId={() => "run-auto"} />);

        expect(send).toHaveBeenCalledTimes(1);
        expect(send).toHaveBeenCalledWith(expect.objectContaining({ kind: "list", cwd: "/repo" }));
    });

    it("does not auto-load again when a re-render leaves cwd unchanged", () => {
        const { transport, emit, send } = createFakeTransport();
        const { rerender } = render(<AiPanel transport={transport} cwd="/repo" changeDir="/repo/openspec/changes" generateRunId={() => "run-auto"} />);

        expect(send).toHaveBeenCalledTimes(1);
        // Let the auto-load finish, so nothing but the guard keeps a second
        // run from being sent.
        emit({ kind: "completed", runId: "run-auto", timestamp: "t" });

        rerender(<AiPanel transport={transport} cwd="/repo" changeDir="/repo/openspec/changes" generateRunId={() => "run-auto"} />);

        expect(send).toHaveBeenCalledTimes(1);
    });

    it("populates the change picker from the auto-load without any click", () => {
        const { transport, emit } = createFakeTransport();
        render(<AiPanel transport={transport} cwd="/repo" changeDir="/repo/openspec/changes" generateRunId={() => "run-auto"} />);

        emit({
            kind: "stdout",
            runId: "run-auto",
            timestamp: "t",
            chunk: JSON.stringify({ changes: [{ name: "first-change" }, { name: "second-change" }] }),
        });
        emit({ kind: "completed", runId: "run-auto", timestamp: "t" });

        const picker = screen.getByTestId("change-picker") as HTMLSelectElement;
        expect(picker).not.toBeDisabled();
        expect(Array.from(picker.querySelectorAll("option")).map((option) => option.value)).toEqual([
            "",
            "first-change",
            "second-change",
        ]);
        expect(picker.value).toBe("first-change");
    });

    it("keeps the explicit reload control working after the auto-load", () => {
        const { transport, emit, send } = createFakeTransport();
        render(<AiPanel transport={transport} cwd="/repo" changeDir="/repo/openspec/changes" generateRunId={() => "run-auto"} />);

        emit({ kind: "completed", runId: "run-auto", timestamp: "t" });

        const reloadButton = screen.getByTestId("load-changes-button");
        expect(reloadButton).toHaveTextContent("Reload changes");
        fireEvent.click(reloadButton);

        expect(send).toHaveBeenCalledTimes(2);
        expect(send).toHaveBeenLastCalledWith(expect.objectContaining({ kind: "list" }));
    });
});

describe("AiPanel cancel control", () => {
    it("shows the Cancel button only while a run is in flight", () => {
        const { transport, emit } = createFakeTransport();
        // No cwd yet, so the panel does not auto-load changes and the
        // idle -> running -> terminal transition is observable on its own.
        render(<AiPanel transport={transport} cwd="" changeDir="/x" generateRunId={() => "run-cancel-visibility"} />);

        expect(screen.queryByTestId("cancel-run-button")).not.toBeInTheDocument();

        fireEvent.click(screen.getByTestId("run-button"));
        expect(screen.getByTestId("cancel-run-button")).toBeInTheDocument();

        emit({ kind: "completed", runId: "run-cancel-visibility", timestamp: "t" });
        expect(screen.queryByTestId("cancel-run-button")).not.toBeInTheDocument();
    });

    it("sends exactly one cancel command naming the run that was started", () => {
        const { transport, send } = createFakeTransport();
        render(<AiPanel transport={transport} cwd="/repo" changeDir="/x" generateRunId={() => "run-cancel-id"} />);

        fireEvent.click(screen.getByTestId("run-button"));
        send.mockClear();
        fireEvent.click(screen.getByTestId("cancel-run-button"));

        expect(send).toHaveBeenCalledTimes(1);
        expect(send).toHaveBeenLastCalledWith(
            expect.objectContaining({ kind: "cancel", runId: "run-cancel-id" }),
        );
    });

    it("carries the same changeDir the run was started with, including the list case", () => {
        const { transport, send } = createFakeTransport();
        // cwd="" so the panel does not auto-fire its own "list" run first —
        // the run under test must be the one whose changeDir the cancel echoes.
        render(
            <AiPanel
                transport={transport}
                cwd="/repo"
                changeDir="/repo/openspec/changes/some-change"
                generateRunId={() => "run-cancel-changedir"}
            />,
        );

        // Default commandKind is "list": effectiveChangeDir is the changes
        // root, not the specific change directory.
        fireEvent.click(screen.getByTestId("run-button"));
        fireEvent.click(screen.getByTestId("cancel-run-button"));

        expect(send).toHaveBeenLastCalledWith({
            kind: "cancel",
            cwd: "/repo",
            runId: "run-cancel-changedir",
            context: { changeDir: "/repo/openspec/changes", promptContext: undefined },
        } satisfies Command);
    });

    it("cancelling a run that just reached a terminal event sends the command without throwing", () => {
        const { transport, emit, send } = createFakeTransport();
        render(<AiPanel transport={transport} cwd="" changeDir="/x" generateRunId={() => "run-cancel-race"} />);

        fireEvent.click(screen.getByTestId("run-button"));
        const cancelButton = screen.getByTestId("cancel-run-button");

        // The race: the click and the run's terminal event are in flight at
        // the same time. The panel already treats a cancel for an unknown
        // runId as a no-op elsewhere (agent-runner.ts) — this asserts the
        // button side never throws either, and the terminal state still wins.
        expect(() => fireEvent.click(cancelButton)).not.toThrow();
        expect(() => emit({ kind: "completed", runId: "run-cancel-race", timestamp: "t" })).not.toThrow();

        expect(send).toHaveBeenCalledWith(
            expect.objectContaining({ kind: "cancel", runId: "run-cancel-race" }),
        );
        expect(screen.getByTestId("run-status-label")).toHaveTextContent("Completed");
    });
});
