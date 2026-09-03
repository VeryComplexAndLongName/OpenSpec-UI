import { describe, expect, it } from "vitest";
import {
    DASHBOARD_CONTEXT_MESSAGE_TYPE,
    isDashboardContextMessage,
    resolveInitialDashboardContext,
} from "./extension-context.js";

describe("extension dashboard context", () => {
    it("prefers host-provided paths over stored values", () => {
        const container = document.createElement("div");
        container.dataset.workspaceRoot = "C:\\repo";
        container.dataset.changeDirectory = "C:\\repo\\openspec\\changes";

        expect(resolveInitialDashboardContext(container, (key) => `stored-${key}`)).toEqual({
            cwd: "C:\\repo",
            changeDir: "C:\\repo\\openspec\\changes",
            startChain: false,
            runChange: false,
        });
    });

    it("falls back to stored values when host context is absent", () => {
        const container = document.createElement("div");

        expect(resolveInitialDashboardContext(container, (key) => `stored-${key}`)).toEqual({
            cwd: "stored-cwd",
            changeDir: "stored-changeDir",
            startChain: false,
            runChange: false,
        });
    });

    it("reads startChain from the initial HTML dataset", () => {
        const container = document.createElement("div");
        container.dataset.workspaceRoot = "C:\\repo";
        container.dataset.changeDirectory = "C:\\repo\\openspec\\changes\\demo";
        container.dataset.startChain = "true";

        expect(resolveInitialDashboardContext(container, () => "").startChain).toBe(true);
    });

    it("reads runChange from the initial HTML dataset", () => {
        const container = document.createElement("div");
        container.dataset.workspaceRoot = "C:\\repo";
        container.dataset.changeDirectory = "C:\\repo\\openspec\\changes\\demo";
        container.dataset.runChange = "true";

        expect(resolveInitialDashboardContext(container, () => "").runChange).toBe(true);
    });

    it("defaults runChange to false when the dataset does not set it", () => {
        const container = document.createElement("div");
        container.dataset.workspaceRoot = "C:\\repo";
        container.dataset.changeDirectory = "C:\\repo\\openspec\\changes\\demo";

        expect(resolveInitialDashboardContext(container, () => "").runChange).toBe(false);
    });

    it("accepts only typed host context messages", () => {
        expect(isDashboardContextMessage({
            type: DASHBOARD_CONTEXT_MESSAGE_TYPE,
            context: { cwd: "/repo", changeDir: "/repo/openspec/changes/demo" },
        })).toBe(true);
        expect(isDashboardContextMessage({
            type: DASHBOARD_CONTEXT_MESSAGE_TYPE,
            context: { cwd: "/repo" },
        })).toBe(false);
    });

    it("accepts a follow-up context message carrying detectedAgents", () => {
        expect(isDashboardContextMessage({
            type: DASHBOARD_CONTEXT_MESSAGE_TYPE,
            context: {
                cwd: "/repo",
                changeDir: "/repo/openspec/changes/demo",
                detectedAgents: { "claude-cli": true, "copilot-cli": false },
            },
        })).toBe(true);
    });
});
