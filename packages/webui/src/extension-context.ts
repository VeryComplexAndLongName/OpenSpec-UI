import type { RunPathId, RunPlan } from "@openspec-ui/core/browser";

export const DASHBOARD_CONTEXT_MESSAGE_TYPE = "openspec-ui/context";

/** What the webview posts back when someone answers the run dialog.
 *
 * A path is not here: choosing one only decides which component mounts,
 * and both are already in this bundle. Only the two answers the host
 * alone can carry out travel — opening a chat session, and writing a
 * file. See run-dialog-in-the-panel. */
export const RUN_CHOICE_MESSAGE_TYPE = "openspec-ui/run-choice";

export type RunChoiceMessage =
    | { type: typeof RUN_CHOICE_MESSAGE_TYPE; choice: "vscode-agent" }
    /** The configuration's id, not its contents. The host has the list;
     * taking what to write from a message would let the webview decide
     * what lands in a file. */
    | { type: typeof RUN_CHOICE_MESSAGE_TYPE; choice: "apply-template"; templateId: string };

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
    /** The resolved harness `budget` for the current change, resolved by
     * the extension host alongside `stepAgents` and delivered in the same
     * follow-up context message. Shown beside a chain's recorded usage so
     * a configured ceiling is legible; nothing in the webview enforces it.
     * Absent means no ceiling is shown at all — never a ceiling of zero. */
    budget?: { maxCostUsd?: number; maxTokens?: number };
    /** Set by `openspec-ui.runWithHarness` (`agentic-harness-run-menu`)
     * when the resolved harness config for the change targets `"chain"`
     * rather than `"picker"` (see `resolveRunWithHarnessTarget` in
     * `@openspec-ui/core`) — decides whether `extension-entry.tsx` mounts
     * `HarnessChainPanel` instead of `AiPanel`. Unlike `detectedAgents`/
     * `stepAgents`, known and needed on the very first render, so it is
     * also read from the initial HTML dataset, not only follow-up
     * messages. */
    startChain?: boolean;
    /** The panel was opened to run this specific change — see
     * `AiPanelContext.runChange` on the extension side. Read from the
     * first render's HTML, like `startChain`, because the panel's initial
     * command kind depends on it. */
    runChange?: boolean;
    /** The resolved run plan, when the panel was opened by `Run`. Built
     * host-side — the browser can read neither the harness files, the
     * audit log nor the task list — and present on the very first render,
     * because it decides whether the dialog mounts instead of the panel.
     * See run-dialog-in-the-panel. */
    runPlan?: RunPlan;
    /** The change the plan is about. The dialog names it, and a choice
     * posted back is about this change. */
    changeName?: string;
    /** Why the dialog opened, when a schedule opened it rather than a
     * person. See a-run-can-be-scheduled. */
    runNote?: string;
    /** The path a schedule already chose. The dialog renders so the note
     * can be read, and then takes this path without waiting — the choice
     * was made when the run was asked for. Absent when a person opened
     * the dialog, and absent when the plan no longer offers it.
     * See a-schedule-keeps-its-promise. */
    runPath?: RunPathId;
    /** Mount the harness settings view. Like the plan it decides which
     * component mounts, so it is read from the first render's HTML. See
     * harness-settings-in-the-panel. */
    showSettings?: boolean;
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
        startChain: container.dataset.startChain === "true",
        runChange: container.dataset.runChange === "true",
        showSettings: container.dataset.showSettings === "true",
        ...readRunPlan(container),
    };
}

/** The plan rides in the first render's HTML as JSON, because it decides
 * which component mounts and a follow-up message would show the wrong one
 * first. Unparseable JSON mounts the ordinary panel rather than throwing:
 * a malformed attribute should cost the dialog, not the whole webview. */
function readRunPlan(
    container: HTMLElement,
): { runPlan?: RunPlan; changeName?: string; runNote?: string; runPath?: RunPathId } {
    const raw = container.dataset.runPlan;
    if (!raw) return {};
    try {
        const parsed = JSON.parse(raw) as {
            plan?: RunPlan;
            changeName?: string;
            note?: string;
            path?: RunPathId;
        };
        if (!parsed.plan) return {};
        return {
          runPlan: parsed.plan,
          ...(parsed.changeName ? { changeName: parsed.changeName } : {}),
          ...(parsed.note ? { runNote: parsed.note } : {}),
          ...(parsed.path ? { runPath: parsed.path } : {}),
        };
    } catch {
        return {};
    }
}

export function isDashboardContextMessage(value: unknown): value is DashboardContextMessage {
    if (typeof value !== "object" || value === null) return false;
    const candidate = value as Record<string, unknown>;
    if (candidate.type !== DASHBOARD_CONTEXT_MESSAGE_TYPE) return false;
    if (typeof candidate.context !== "object" || candidate.context === null) return false;
    const context = candidate.context as Record<string, unknown>;
    return typeof context.cwd === "string" && typeof context.changeDir === "string";
}
