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
        });
    });

    it("falls back to stored values when host context is absent", () => {
        const container = document.createElement("div");

        expect(resolveInitialDashboardContext(container, (key) => `stored-${key}`)).toEqual({
            cwd: "stored-cwd",
            changeDir: "stored-changeDir",
        });
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
});
