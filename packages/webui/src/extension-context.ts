export const DASHBOARD_CONTEXT_MESSAGE_TYPE = "openspec-ui/context";

export interface DashboardContext {
    cwd: string;
    changeDir: string;
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
