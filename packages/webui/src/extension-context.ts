export const DASHBOARD_CONTEXT_MESSAGE_TYPE = "openspec-ui/context";

export interface DashboardContext {
    cwd: string;
    changeDir: string;
    /** Best-effort agent presence signal, computed by the extension host via
     * a direct core import and delivered as a follow-up context message once
     * detection resolves (see openspec/changes/agent-detection/design.md,
     * "Extension: detection runs after reveal(), posted as a follow-up
     * context message"). Absent on the initial context message. */
    detectedAgents?: Record<string, boolean>;
    /** Agentic Harness `stepAgents` recommendation for the currently
     * loaded change, resolved by the extension host via a direct core
     * import — see openspec/changes/agentic-harness/. Absent when no
     * harness config exists for the workspace/change. */
    stepAgents?: Partial<Record<"propose" | "review" | "apply", string>>;
}

export interface DashboardContextMessage {
    type: typeof DASHBOARD_CONTEXT_MESSAGE_TYPE;
    context: DashboardContext;
}

export function resolveInitialDashboardContext(
    container: HTMLElement,
    readStoredValue: (key: "cwd" | "changeDir") => string,
): DashboardContext {
    return {
        cwd: container.dataset.workspaceRoot || readStoredValue("cwd"),
        changeDir: container.dataset.changeDirectory || readStoredValue("changeDir"),
    };
}

export function isDashboardContextMessage(value: unknown): value is DashboardContextMessage {
    if (typeof value !== "object" || value === null) return false;
    const candidate = value as Record<string, unknown>;
    if (candidate.type !== DASHBOARD_CONTEXT_MESSAGE_TYPE) return false;
    if (typeof candidate.context !== "object" || candidate.context === null) return false;
    const context = candidate.context as Record<string, unknown>;
    return typeof context.cwd === "string" && typeof context.changeDir === "string";
}
