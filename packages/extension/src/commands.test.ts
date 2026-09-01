import path from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";
import { createVscodeMock } from "./test-utils/vscode-mock.js";

const vscodeMock = createVscodeMock();
vi.mock("vscode", () => vscodeMock);

const listChangesMock = vi.fn();
const listSpecsMock = vi.fn();
const showChangeMock = vi.fn();
const validateChangeMock = vi.fn();
const archiveChangeMock = vi.fn();
const checkChangesetReminderMock = vi.fn();
const getChangeTimelineMock = vi.fn();
const getChangeTimelinesMock = vi.fn();
const buildSprintReportMock = vi.fn();
const renderSprintReportPdfMock = vi.fn();
const discoverOpenSpecWorkspaceMock = vi.fn();
const createChangeMock = vi.fn();
const deleteChangeMock = vi.fn();
const unarchiveChangeMock = vi.fn();
const initOpenSpecMock = vi.fn();
const readArchivedChangeTasksTemplateMock = vi.fn();
const customizeTemplateMock = vi.fn();
const deleteProjectTemplateMock = vi.fn();
const deleteTaskLineMock = vi.fn();
const renderTemplateMock = vi.fn();
const writeAgentInstructionsMock = vi.fn();
const writeDependabotConfigMock = vi.fn();
const writeSubtypeInstructionsMock = vi.fn();
const writeGlobalHarnessConfigMock = vi.fn();
const writeChangeHarnessConfigMock = vi.fn();
const resolveHarnessConfigMock = vi.fn();
const resolveRunWithHarnessTargetMock = vi.fn();
class TemplateAlreadyExistsError extends Error {}
class UnknownProjectTemplateError extends Error {}
class TaskListChangedError extends Error {}
const TASK_CHECKBOX_LINE_RE = /^[ \t]*-\s\[([ xX])\]\s*(.*)$/;
vi.mock("@openspec-ui/core", () => ({
  AGENT_REGISTRY: [
    { id: "claude-cli", label: "Claude CLI" },
    { id: "copilot-cli", label: "GitHub Copilot CLI" },
    { id: "codex-cli", label: "Codex CLI" },
    { id: "gemini-cli", label: "Gemini CLI" },
    { id: "local-llm", label: "Local LLM (OpenAI-compatible)" },
  ],
  DEFAULT_HARNESS_CONFIG: { stepAgents: {}, autonomyLevel: "assisted", reviewGate: { mode: "human-required" } },
  DEFAULT_STALE_TASK_THRESHOLD_DAYS: 14,
  archiveChange: (...args: unknown[]) => archiveChangeMock(...args),
  buildSprintReport: (...args: unknown[]) => buildSprintReportMock(...args),
  checkChangesetReminder: (...args: unknown[]) => checkChangesetReminderMock(...args),
  createChange: (...args: unknown[]) => createChangeMock(...args),
  customizeTemplate: (...args: unknown[]) => customizeTemplateMock(...args),
  deleteChange: (...args: unknown[]) => deleteChangeMock(...args),
  deleteProjectTemplate: (...args: unknown[]) => deleteProjectTemplateMock(...args),
  deleteTaskLine: (...args: unknown[]) => deleteTaskLineMock(...args),
  discoverOpenSpecWorkspace: (...args: unknown[]) => discoverOpenSpecWorkspaceMock(...args),
  getChangeTimeline: (...args: unknown[]) => getChangeTimelineMock(...args),
  getChangeTimelines: (...args: unknown[]) => getChangeTimelinesMock(...args),
  initOpenSpec: (...args: unknown[]) => initOpenSpecMock(...args),
  listBootstrapProjectTypes: () => [
    { id: "node", label: "Node.js / TypeScript" },
    { id: "python", label: "Python" },
  ],
  listChanges: (...args: unknown[]) => listChangesMock(...args),
  listSpecs: (...args: unknown[]) => listSpecsMock(...args),
  readArchivedChangeTasksTemplate: (...args: unknown[]) => readArchivedChangeTasksTemplateMock(...args),
  renderSprintReportPdf: (...args: unknown[]) => renderSprintReportPdfMock(...args),
  renderTemplate: (...args: unknown[]) => renderTemplateMock(...args),
  resolveHarnessConfig: (...args: unknown[]) => resolveHarnessConfigMock(...args),
  resolveRunWithHarnessTarget: (...args: unknown[]) => resolveRunWithHarnessTargetMock(...args),
  showChange: (...args: unknown[]) => showChangeMock(...args),
  TASK_CHECKBOX_LINE_RE,
  TaskListChangedError,
  TemplateAlreadyExistsError,
  UnknownProjectTemplateError,
  unarchiveChange: (...args: unknown[]) => unarchiveChangeMock(...args),
  writeAgentInstructions: (...args: unknown[]) => writeAgentInstructionsMock(...args),
  writeChangeHarnessConfig: (...args: unknown[]) => writeChangeHarnessConfigMock(...args),
  writeDependabotConfig: (...args: unknown[]) => writeDependabotConfigMock(...args),
  writeGlobalHarnessConfig: (...args: unknown[]) => writeGlobalHarnessConfigMock(...args),
  writeSubtypeInstructions: (...args: unknown[]) => writeSubtypeInstructionsMock(...args),
  validateChange: (...args: unknown[]) => validateChangeMock(...args),
}));

const openDiffAgainstHeadMock = vi.fn();
vi.mock("./native/diff.js", () => ({ openDiffAgainstHead: (...args: unknown[]) => openDiffAgainstHeadMock(...args) }));

const timelinePanelShowMock = vi.fn();
const timelinePanelShowMultiMock = vi.fn();
vi.mock("./webview/timeline-panel.js", () => ({
  TimelineWebviewPanel: vi.fn().mockImplementation(() => ({
    show: timelinePanelShowMock,
    showMulti: timelinePanelShowMultiMock,
  })),
}));

const { registerCommands } = await import("./commands.js");
const { RunController } = await import("./run-controller.js");

afterEach(() => {
  vi.clearAllMocks();
  vscodeMock._documentContents.clear();
});

function makeContext() {
  return { subscriptions: [] as Array<{ dispose(): void }> };
}

function makeDeps(overrides: Partial<Parameters<typeof registerCommands>[1]> = {}) {
  const runController = new RunController();
  const outputChannel = { appendLine: vi.fn(), clear: vi.fn(), show: vi.fn() };
  const scheduler = {
    start: vi.fn((options: { execute: (context: { signal: AbortSignal; report: (value: string) => void }) => Promise<unknown> }) => ({
      id: "test-process",
      cancel: vi.fn(),
      completion: options.execute({ signal: new AbortController().signal, report: vi.fn() })
        .then((summary) => ({ state: "completed", summary }))
        .catch((error: unknown) => ({ state: "failed", error: error instanceof Error ? error.message : String(error) })),
    })),
    cancel: vi.fn(),
  };
  const implementationSessions = {
    run: vi.fn(async (_root: string, options: { execute: () => Promise<unknown> }) => {
      try {
        const summary = await options.execute();
        return { state: "completed", summary };
      } catch (error) {
        return { state: "failed", error: error instanceof Error ? error.message : String(error) };
      }
    }),
    start: vi.fn(async () => "implementation-process"),
    finish: vi.fn(() => true),
    cancel: vi.fn(() => true),
    getDelta: vi.fn(() => undefined),
    getCoverage: vi.fn(() => undefined),
    rollback: vi.fn(),
    changeRollbackDetails: vi.fn(() => undefined),
    rollbackChange: vi.fn(),
  };
  return {
    getWorkspaceRoot: () => "/workspace/repo",
    runController,
    outputChannel: outputChannel as unknown as import("vscode").OutputChannel,
    revealAiPanel: vi.fn(),
    refreshTrees: vi.fn(),
    refreshTemplatesTree: vi.fn(),
    scheduler: scheduler as unknown as import("@openspec-ui/core").WorkbenchProcessScheduler,
    implementationSessions: implementationSessions as unknown as import("./implementation-sessions.js").ImplementationSessionManager,
    changesView: { selection: [] as unknown[] },
    archiveView: { selection: [] as unknown[] },
    templatesView: { selection: [] as unknown[] },
    ...overrides,
  };
}

describe("registerCommands", () => {
  it("registers all expected command ids", () => {
    const context = makeContext();
    registerCommands(context as unknown as import("vscode").ExtensionContext, makeDeps());

    const registered = [...vscodeMock._registeredCommands.keys()];
    expect(registered).toEqual(
      expect.arrayContaining([
        "openspec-ui.status",
        "openspec-ui.initialize",
        "openspec-ui.generateAgentInstructions",
        "openspec-ui.configureDependabot",
        "openspec-ui.generateSubtypeInstructions",
        "openspec-ui.createChange",
        "openspec-ui.validateSelectedChange",
        "openspec-ui.showChangeTimeline",
        "openspec-ui.showAllChangesTimeline",
        "openspec-ui.generateSprintReport",
        "openspec-ui.archiveChange",
        "openspec-ui.unarchiveChange",
        "openspec-ui.deleteChange",
        "openspec-ui.revealTask",
        "openspec-ui.deleteTask",
        "openspec-ui.openspecView",
        "openspec-ui.showChangeDetails",
        "openspec-ui.validateChangeStrict",
        "openspec-ui.listSpecsSummary",
        "openspec-ui.openAiPanel",
        "openspec-ui.reviewDiff",
        "openspec-ui.rollbackChange",
      ]),
    );
  });

  it("creates a change and refreshes all trees", async () => {
    vscodeMock.window.showInputBox.mockResolvedValue("new-workbench-change");
    createChangeMock.mockResolvedValue({ ok: true });
    const deps = makeDeps();
    registerCommands(makeContext() as unknown as import("vscode").ExtensionContext, deps);

    await vscodeMock._registeredCommands.get("openspec-ui.createChange")?.();

    expect(createChangeMock).toHaveBeenCalledWith("new-workbench-change", { cwd: "/workspace/repo" });
    expect(deps.refreshTrees).toHaveBeenCalled();
  });

  describe("openspec-ui.createChangeTemplate", () => {
    const INHERIT = "(inherit from global default)";

    it("creates the change and writes nothing when the user picks global defaults", async () => {
      vscodeMock.window.showInputBox.mockResolvedValue("demo-change");
      createChangeMock.mockResolvedValue({ ok: true });
      vscodeMock.window.showQuickPick.mockResolvedValueOnce("Use global Agentic Harness defaults");
      const deps = makeDeps();
      registerCommands(makeContext() as unknown as import("vscode").ExtensionContext, deps);

      await vscodeMock._registeredCommands.get("openspec-ui.createChangeTemplate")?.();

      expect(createChangeMock).toHaveBeenCalledWith("demo-change", { cwd: "/workspace/repo" });
      expect(deps.refreshTrees).toHaveBeenCalled();
      expect(writeChangeHarnessConfigMock).not.toHaveBeenCalled();
    });

    it("writes only the explicitly customized fields", async () => {
      vscodeMock.window.showInputBox.mockResolvedValue("demo-change");
      createChangeMock.mockResolvedValue({ ok: true });
      vscodeMock.window.showQuickPick
        .mockResolvedValueOnce("Customize Agentic Harness for this change")
        .mockResolvedValueOnce("Claude CLI") // propose
        .mockResolvedValueOnce(INHERIT) // review
        .mockResolvedValueOnce("GitHub Copilot CLI") // apply
        .mockResolvedValueOnce(INHERIT) // verify
        .mockResolvedValueOnce(INHERIT) // archive
        .mockResolvedValueOnce({ label: "autonomous" })
        .mockResolvedValueOnce({ label: "agent-sufficient" });
      const deps = makeDeps();
      registerCommands(makeContext() as unknown as import("vscode").ExtensionContext, deps);

      await vscodeMock._registeredCommands.get("openspec-ui.createChangeTemplate")?.();

      expect(writeChangeHarnessConfigMock).toHaveBeenCalledWith("/workspace/repo", "demo-change", {
        stepAgents: { propose: "claude-cli", apply: "copilot-cli" },
        autonomyLevel: "autonomous",
        reviewGate: { mode: "agent-sufficient" },
      });
    });

    it("writes nothing when every customization question is left at inherit/default", async () => {
      vscodeMock.window.showInputBox.mockResolvedValue("demo-change");
      createChangeMock.mockResolvedValue({ ok: true });
      vscodeMock.window.showQuickPick
        .mockResolvedValueOnce("Customize Agentic Harness for this change")
        .mockResolvedValueOnce(INHERIT)
        .mockResolvedValueOnce(INHERIT)
        .mockResolvedValueOnce(INHERIT)
        .mockResolvedValueOnce(INHERIT)
        .mockResolvedValueOnce(INHERIT)
        .mockResolvedValueOnce({ label: INHERIT })
        .mockResolvedValueOnce({ label: INHERIT });
      const deps = makeDeps();
      registerCommands(makeContext() as unknown as import("vscode").ExtensionContext, deps);

      await vscodeMock._registeredCommands.get("openspec-ui.createChangeTemplate")?.();

      expect(writeChangeHarnessConfigMock).not.toHaveBeenCalled();
    });

    it("cancelling mid-wizard discards the whole customization but keeps the change", async () => {
      vscodeMock.window.showInputBox.mockResolvedValue("demo-change");
      createChangeMock.mockResolvedValue({ ok: true });
      vscodeMock.window.showQuickPick
        .mockResolvedValueOnce("Customize Agentic Harness for this change")
        .mockResolvedValueOnce("Claude CLI") // propose answered...
        .mockResolvedValueOnce(undefined); // ...then Esc on review
      const deps = makeDeps();
      registerCommands(makeContext() as unknown as import("vscode").ExtensionContext, deps);

      await vscodeMock._registeredCommands.get("openspec-ui.createChangeTemplate")?.();

      expect(createChangeMock).toHaveBeenCalledWith("demo-change", { cwd: "/workspace/repo" });
      expect(deps.refreshTrees).toHaveBeenCalled();
      expect(writeChangeHarnessConfigMock).not.toHaveBeenCalled();
    });

    it("does nothing without a change id", async () => {
      vscodeMock.window.showInputBox.mockResolvedValue(undefined);
      const deps = makeDeps();
      registerCommands(makeContext() as unknown as import("vscode").ExtensionContext, deps);

      await vscodeMock._registeredCommands.get("openspec-ui.createChangeTemplate")?.();

      expect(createChangeMock).not.toHaveBeenCalled();
      expect(vscodeMock.window.showQuickPick).not.toHaveBeenCalled();
    });
  });

  it("fetches and shows a change timeline for an active change", async () => {
    const timeline = { changeName: "my-change", archived: false, tasks: [] };
    getChangeTimelineMock.mockResolvedValue(timeline);
    const deps = makeDeps();
    registerCommands(makeContext() as unknown as import("vscode").ExtensionContext, deps);

    await vscodeMock._registeredCommands.get("openspec-ui.showChangeTimeline")?.({
      changeName: "my-change",
      archived: false,
    });

    expect(getChangeTimelineMock).toHaveBeenCalledWith("/workspace/repo", "my-change", false);
    expect(timelinePanelShowMock).toHaveBeenCalledWith("my-change", timeline, 14);
  });

  it("reads the stale-task threshold from the openspec-ui.staleTaskThresholdDays setting", async () => {
    const timeline = { changeName: "my-change", archived: false, tasks: [] };
    getChangeTimelineMock.mockResolvedValue(timeline);
    const configuredGet = vi.fn((_key: string, _defaultValue?: unknown) => 30);
    vscodeMock.workspace.getConfiguration.mockReturnValue({ get: configuredGet });
    const deps = makeDeps();
    registerCommands(makeContext() as unknown as import("vscode").ExtensionContext, deps);

    await vscodeMock._registeredCommands.get("openspec-ui.showChangeTimeline")?.({
      changeName: "my-change",
      archived: false,
    });

    expect(configuredGet).toHaveBeenCalledWith("staleTaskThresholdDays", 14);
    expect(timelinePanelShowMock).toHaveBeenCalledWith("my-change", timeline, 30);
  });

  it("fetches an archived change's timeline with archived: true", async () => {
    getChangeTimelineMock.mockResolvedValue({ changeName: "2026-01-01-old", archived: true, tasks: [] });
    const deps = makeDeps();
    registerCommands(makeContext() as unknown as import("vscode").ExtensionContext, deps);

    await vscodeMock._registeredCommands.get("openspec-ui.showChangeTimeline")?.({
      changeName: "2026-01-01-old",
      archived: true,
    });

    expect(getChangeTimelineMock).toHaveBeenCalledWith("/workspace/repo", "2026-01-01-old", true);
  });

  it("reports an error and does not open a panel when the timeline fetch fails", async () => {
    getChangeTimelineMock.mockRejectedValue(new Error("boom"));
    const deps = makeDeps();
    registerCommands(makeContext() as unknown as import("vscode").ExtensionContext, deps);

    await vscodeMock._registeredCommands.get("openspec-ui.showChangeTimeline")?.({
      changeName: "my-change",
      archived: false,
    });

    expect(timelinePanelShowMock).not.toHaveBeenCalled();
    expect(vscodeMock.window.showErrorMessage).toHaveBeenCalledWith(
      expect.stringContaining("show change timeline failed"),
    );
  });

  it("openspec-ui.showChangeTimeline: warns instead of silently doing nothing without a tree item", async () => {
    registerCommands(makeContext() as unknown as import("vscode").ExtensionContext, makeDeps());

    await vscodeMock._registeredCommands.get("openspec-ui.showChangeTimeline")?.();

    expect(vscodeMock.window.showWarningMessage).toHaveBeenCalledWith(
      "OpenSpec UI: select a change in the Changes tree, or run this from its right-click menu.",
    );
    expect(getChangeTimelineMock).not.toHaveBeenCalled();
  });

  describe("openspec-ui.validateSelectedChange", () => {
    it("runs strict validation for the given change and opens a parsed markdown summary", async () => {
      validateChangeMock.mockResolvedValue({
        items: [{ id: "shared-ui", type: "change", valid: true, issues: [], durationMs: 12 }],
        summary: { totals: { items: 1, passed: 1, failed: 0 }, byType: { change: { items: 1, passed: 1, failed: 0 } } },
        version: "1.2.3",
        root: { path: "/workspace/repo", source: "nearest" },
      });
      registerCommands(makeContext() as unknown as import("vscode").ExtensionContext, makeDeps());

      await vscodeMock._registeredCommands.get("openspec-ui.validateSelectedChange")?.({
        changeName: "shared-ui",
        archived: false,
      });

      expect(validateChangeMock).toHaveBeenCalledWith("shared-ui", { cwd: "/workspace/repo" });
      expect(vscodeMock.window.showTextDocument).toHaveBeenCalled();
    });

    it("warns instead of silently doing nothing without a tree item", async () => {
      registerCommands(makeContext() as unknown as import("vscode").ExtensionContext, makeDeps());

      await vscodeMock._registeredCommands.get("openspec-ui.validateSelectedChange")?.();

      expect(vscodeMock.window.showWarningMessage).toHaveBeenCalledWith(
        "OpenSpec UI: select a change in the Changes tree, or run this from its right-click menu.",
      );
      expect(validateChangeMock).not.toHaveBeenCalled();
    });
  });

  it("picks changes across active and archived, fetches, and shows a comparison", async () => {
    discoverOpenSpecWorkspaceMock.mockResolvedValue({
      changes: [{ name: "active-change" }],
      archivedChanges: [{ name: "2026-01-01-old-change" }],
    });
    vscodeMock.window.showQuickPick.mockResolvedValue([
      { label: "active-change", description: "active", archived: false },
      { label: "2026-01-01-old-change", description: "archived", archived: true },
    ]);
    const timelines = [
      {
        changeName: "active-change",
        archived: false,
        createdDate: "2026-01-02T00:00:00.000Z",
        archivedDate: null,
        tasks: [],
      },
      {
        changeName: "2026-01-01-old-change",
        archived: true,
        createdDate: null,
        archivedDate: "2026-01-01",
        tasks: [],
      },
    ];
    getChangeTimelinesMock.mockResolvedValue(timelines);
    const deps = makeDeps();
    registerCommands(makeContext() as unknown as import("vscode").ExtensionContext, deps);

    await vscodeMock._registeredCommands.get("openspec-ui.showAllChangesTimeline")?.();

    expect(getChangeTimelinesMock).toHaveBeenCalledWith("/workspace/repo", [
      { changeName: "active-change", archived: false },
      { changeName: "2026-01-01-old-change", archived: true },
    ]);
    expect(timelinePanelShowMultiMock).toHaveBeenCalledWith(
      expect.objectContaining({
        timelines,
        rangeStart: "2026-01-01T23:59:59.999Z",
        rangeEnd: "2026-01-02T00:00:00.000Z",
      }),
    );
  });

  it("does nothing when no changes are picked for comparison", async () => {
    discoverOpenSpecWorkspaceMock.mockResolvedValue({
      changes: [{ name: "active-change" }],
      archivedChanges: [],
    });
    vscodeMock.window.showQuickPick.mockResolvedValue(undefined);
    const deps = makeDeps();
    registerCommands(makeContext() as unknown as import("vscode").ExtensionContext, deps);

    await vscodeMock._registeredCommands.get("openspec-ui.showAllChangesTimeline")?.();

    expect(getChangeTimelinesMock).not.toHaveBeenCalled();
    expect(timelinePanelShowMultiMock).not.toHaveBeenCalled();
  });

  describe("generateSprintReport", () => {
    function setUpPicker() {
      discoverOpenSpecWorkspaceMock.mockResolvedValue({
        changes: [{ name: "active-change" }],
        archivedChanges: [{ name: "2026-01-01-old-change" }],
      });
      vscodeMock.window.showQuickPick.mockResolvedValue([
        { label: "active-change", description: "active", archived: false },
        { label: "2026-01-01-old-change", description: "archived", archived: true },
      ]);
    }

    it("builds a sprint report for the picked range and changes, then saves and offers to open the PDF", async () => {
      setUpPicker();
      vscodeMock.window.showInputBox
        .mockResolvedValueOnce("2026-08-01")
        .mockResolvedValueOnce("2026-08-14");
      const report = { rangeStart: "2026-08-01T00:00:00.000Z", rangeEnd: "2026-08-14T23:59:59.999Z", entries: [], stats: {} };
      buildSprintReportMock.mockResolvedValue(report);
      const pdf = Buffer.from("pdf-bytes");
      renderSprintReportPdfMock.mockResolvedValue(pdf);
      const target = vscodeMock.Uri.file("/workspace/repo/sprint-report-2026-08-01-2026-08-14.pdf");
      vscodeMock.window.showSaveDialog.mockResolvedValue(target);
      vscodeMock.window.showInformationMessage.mockResolvedValue("Open");
      const deps = makeDeps();
      registerCommands(makeContext() as unknown as import("vscode").ExtensionContext, deps);

      await vscodeMock._registeredCommands.get("openspec-ui.generateSprintReport")?.();

      expect(buildSprintReportMock).toHaveBeenCalledWith(
        "/workspace/repo",
        [
          { changeName: "active-change", archived: false },
          { changeName: "2026-01-01-old-change", archived: true },
        ],
        "2026-08-01T00:00:00.000Z",
        "2026-08-14T23:59:59.999Z",
      );
      expect(renderSprintReportPdfMock).toHaveBeenCalledWith(report);
      expect(vscodeMock.workspace.fs.writeFile).toHaveBeenCalledWith(target, pdf);
      expect(vscodeMock.env.openExternal).toHaveBeenCalledWith(target);
    });

    it("does nothing when no changes are picked", async () => {
      discoverOpenSpecWorkspaceMock.mockResolvedValue({
        changes: [{ name: "active-change" }],
        archivedChanges: [],
      });
      vscodeMock.window.showQuickPick.mockResolvedValue(undefined);
      const deps = makeDeps();
      registerCommands(makeContext() as unknown as import("vscode").ExtensionContext, deps);

      await vscodeMock._registeredCommands.get("openspec-ui.generateSprintReport")?.();

      expect(vscodeMock.window.showInputBox).not.toHaveBeenCalled();
      expect(buildSprintReportMock).not.toHaveBeenCalled();
    });

    it("does nothing when the start date prompt is dismissed", async () => {
      setUpPicker();
      vscodeMock.window.showInputBox.mockResolvedValueOnce(undefined);
      const deps = makeDeps();
      registerCommands(makeContext() as unknown as import("vscode").ExtensionContext, deps);

      await vscodeMock._registeredCommands.get("openspec-ui.generateSprintReport")?.();

      expect(buildSprintReportMock).not.toHaveBeenCalled();
    });

    it("does nothing when the end date prompt is dismissed", async () => {
      setUpPicker();
      vscodeMock.window.showInputBox.mockResolvedValueOnce("2026-08-01").mockResolvedValueOnce(undefined);
      const deps = makeDeps();
      registerCommands(makeContext() as unknown as import("vscode").ExtensionContext, deps);

      await vscodeMock._registeredCommands.get("openspec-ui.generateSprintReport")?.();

      expect(buildSprintReportMock).not.toHaveBeenCalled();
    });

    it("wires a YYYY-MM-DD validator into both date prompts", async () => {
      setUpPicker();
      vscodeMock.window.showInputBox.mockResolvedValue(undefined);
      const deps = makeDeps();
      registerCommands(makeContext() as unknown as import("vscode").ExtensionContext, deps);

      await vscodeMock._registeredCommands.get("openspec-ui.generateSprintReport")?.();

      const options = vscodeMock.window.showInputBox.mock.calls[0]?.[0] as {
        validateInput?: (value: string) => string | undefined;
      };
      expect(options.validateInput?.("not-a-date")).toBe("Enter a date as YYYY-MM-DD.");
      expect(options.validateInput?.("2026-08-01")).toBeUndefined();
    });

    it("does not write a file when the save dialog is dismissed", async () => {
      setUpPicker();
      vscodeMock.window.showInputBox
        .mockResolvedValueOnce("2026-08-01")
        .mockResolvedValueOnce("2026-08-14");
      buildSprintReportMock.mockResolvedValue({ entries: [] });
      renderSprintReportPdfMock.mockResolvedValue(Buffer.from("pdf-bytes"));
      vscodeMock.window.showSaveDialog.mockResolvedValue(undefined);
      const deps = makeDeps();
      registerCommands(makeContext() as unknown as import("vscode").ExtensionContext, deps);

      await vscodeMock._registeredCommands.get("openspec-ui.generateSprintReport")?.();

      expect(vscodeMock.workspace.fs.writeFile).not.toHaveBeenCalled();
      expect(vscodeMock.env.openExternal).not.toHaveBeenCalled();
    });

    it("does not open the PDF when the confirmation message is dismissed", async () => {
      setUpPicker();
      vscodeMock.window.showInputBox
        .mockResolvedValueOnce("2026-08-01")
        .mockResolvedValueOnce("2026-08-14");
      buildSprintReportMock.mockResolvedValue({ entries: [] });
      renderSprintReportPdfMock.mockResolvedValue(Buffer.from("pdf-bytes"));
      vscodeMock.window.showSaveDialog.mockResolvedValue(vscodeMock.Uri.file("/workspace/repo/report.pdf"));
      vscodeMock.window.showInformationMessage.mockResolvedValue(undefined);
      const deps = makeDeps();
      registerCommands(makeContext() as unknown as import("vscode").ExtensionContext, deps);

      await vscodeMock._registeredCommands.get("openspec-ui.generateSprintReport")?.();

      expect(vscodeMock.workspace.fs.writeFile).toHaveBeenCalled();
      expect(vscodeMock.env.openExternal).not.toHaveBeenCalled();
    });

    it("reports an error and writes no file when building the report fails", async () => {
      setUpPicker();
      vscodeMock.window.showInputBox
        .mockResolvedValueOnce("2026-08-01")
        .mockResolvedValueOnce("2026-08-14");
      buildSprintReportMock.mockRejectedValue(new Error("boom"));
      const deps = makeDeps();
      registerCommands(makeContext() as unknown as import("vscode").ExtensionContext, deps);

      await vscodeMock._registeredCommands.get("openspec-ui.generateSprintReport")?.();

      expect(vscodeMock.workspace.fs.writeFile).not.toHaveBeenCalled();
      expect(vscodeMock.window.showErrorMessage).toHaveBeenCalledWith(
        expect.stringContaining("generate sprint report failed"),
      );
    });
  });

  it("archives a confirmed active change and refreshes", async () => {
    vscodeMock.window.showWarningMessage.mockResolvedValue("Archive");
    archiveChangeMock.mockResolvedValue({ ok: true });
    checkChangesetReminderMock.mockResolvedValue({ changesetsAdopted: false, pendingChangesetCount: 0 });
    const deps = makeDeps();
    registerCommands(makeContext() as unknown as import("vscode").ExtensionContext, deps);

    await vscodeMock._registeredCommands.get("openspec-ui.archiveChange")?.({
      changeName: "done-change",
      archived: false,
    });

    expect(archiveChangeMock).toHaveBeenCalledWith("done-change", { cwd: "/workspace/repo" });
    expect(deps.refreshTrees).toHaveBeenCalled();
  });

  it("offers to run npx changeset after archiving when Changesets is adopted but nothing is pending", async () => {
    vscodeMock.window.showWarningMessage.mockResolvedValue("Archive");
    archiveChangeMock.mockResolvedValue({ ok: true });
    checkChangesetReminderMock.mockResolvedValue({ changesetsAdopted: true, pendingChangesetCount: 0 });
    vscodeMock.window.showInformationMessage.mockResolvedValue("Run npx changeset");
    const deps = makeDeps();
    registerCommands(makeContext() as unknown as import("vscode").ExtensionContext, deps);

    await vscodeMock._registeredCommands.get("openspec-ui.archiveChange")?.({
      changeName: "done-change",
      archived: false,
    });

    await vi.waitFor(() => expect(vscodeMock.window.createTerminal).toHaveBeenCalled());
    const terminal = vscodeMock.window.createTerminal.mock.results[0]?.value;
    expect(terminal.sendText).toHaveBeenCalledWith("npx changeset", true);
  });

  it("does not offer a changeset reminder when one is already pending", async () => {
    vscodeMock.window.showWarningMessage.mockResolvedValue("Archive");
    archiveChangeMock.mockResolvedValue({ ok: true });
    checkChangesetReminderMock.mockResolvedValue({ changesetsAdopted: true, pendingChangesetCount: 1 });
    const deps = makeDeps();
    registerCommands(makeContext() as unknown as import("vscode").ExtensionContext, deps);

    await vscodeMock._registeredCommands.get("openspec-ui.archiveChange")?.({
      changeName: "done-change",
      archived: false,
    });

    await vi.waitFor(() => expect(checkChangesetReminderMock).toHaveBeenCalled());
    expect(vscodeMock.window.createTerminal).not.toHaveBeenCalled();
  });

  it("openspec-ui.archiveChange: warns instead of silently doing nothing without a tree item", async () => {
    registerCommands(makeContext() as unknown as import("vscode").ExtensionContext, makeDeps());

    await vscodeMock._registeredCommands.get("openspec-ui.archiveChange")?.();

    expect(vscodeMock.window.showWarningMessage).toHaveBeenCalledWith(
      "OpenSpec UI: select a change in the Changes tree, or run this from its right-click menu.",
    );
    expect(archiveChangeMock).not.toHaveBeenCalled();
  });

  it("unarchives and deletes only after explicit confirmation", async () => {
    vscodeMock.window.showWarningMessage
      .mockResolvedValueOnce("Unarchive")
      .mockResolvedValueOnce("Delete");
    const deps = makeDeps();
    registerCommands(makeContext() as unknown as import("vscode").ExtensionContext, deps);
    const archivedItem = { changeName: "old-change", archived: true };

    await vscodeMock._registeredCommands.get("openspec-ui.unarchiveChange")?.(archivedItem);
    await vscodeMock._registeredCommands.get("openspec-ui.deleteChange")?.(archivedItem);

    expect(unarchiveChangeMock).toHaveBeenCalledWith("/workspace/repo", "old-change");
    expect(deleteChangeMock).toHaveBeenCalledWith("/workspace/repo", "old-change", "archive");
    expect(deps.refreshTrees).toHaveBeenCalledTimes(2);
  });

  it("openspec-ui.unarchiveChange: warns instead of silently doing nothing without a tree item", async () => {
    registerCommands(makeContext() as unknown as import("vscode").ExtensionContext, makeDeps());

    await vscodeMock._registeredCommands.get("openspec-ui.unarchiveChange")?.();

    expect(vscodeMock.window.showWarningMessage).toHaveBeenCalledWith(
      "OpenSpec UI: select a change in the Changes tree, or run this from its right-click menu.",
    );
    expect(unarchiveChangeMock).not.toHaveBeenCalled();
  });

  it("openspec-ui.deleteChange: warns instead of silently doing nothing without a tree item", async () => {
    registerCommands(makeContext() as unknown as import("vscode").ExtensionContext, makeDeps());

    await vscodeMock._registeredCommands.get("openspec-ui.deleteChange")?.();

    expect(vscodeMock.window.showWarningMessage).toHaveBeenCalledWith(
      "OpenSpec UI: select a change in the Changes tree, or run this from its right-click menu.",
    );
    expect(deleteChangeMock).not.toHaveBeenCalled();
  });

  describe("openspec-ui.rollbackChange", () => {
    const changeItem = { changeName: "demo-change", archived: false };

    it("rolls back after confirmation and refreshes trees", async () => {
      const deps = makeDeps();
      (deps.implementationSessions.changeRollbackDetails as ReturnType<typeof vi.fn>).mockReturnValue({
        processCount: 2,
        fileCount: 3,
      });
      (deps.implementationSessions.rollbackChange as ReturnType<typeof vi.fn>).mockResolvedValue({
        restored: ["a.txt", "b.txt", "c.txt"],
        conflicts: [],
      });
      vscodeMock.window.showWarningMessage.mockResolvedValue("Rollback");
      registerCommands(makeContext() as unknown as import("vscode").ExtensionContext, deps);

      await vscodeMock._registeredCommands.get("openspec-ui.rollbackChange")?.(changeItem);

      expect(deps.implementationSessions.rollbackChange).toHaveBeenCalledWith("demo-change");
      expect(deps.refreshTrees).toHaveBeenCalled();
    });

    it("reports no rollback-eligible processes instead of showing a confirmation", async () => {
      const deps = makeDeps();
      registerCommands(makeContext() as unknown as import("vscode").ExtensionContext, deps);

      await vscodeMock._registeredCommands.get("openspec-ui.rollbackChange")?.(changeItem);

      expect(vscodeMock.window.showWarningMessage).toHaveBeenCalledWith(
        expect.stringContaining("no rollback-eligible processes"),
      );
      expect(vscodeMock.window.showWarningMessage).not.toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({ modal: true }),
        expect.anything(),
      );
      expect(deps.implementationSessions.rollbackChange).not.toHaveBeenCalled();
    });

    it("does not roll back when the confirmation is declined", async () => {
      const deps = makeDeps();
      (deps.implementationSessions.changeRollbackDetails as ReturnType<typeof vi.fn>).mockReturnValue({
        processCount: 1,
        fileCount: 1,
      });
      vscodeMock.window.showWarningMessage.mockResolvedValue(undefined);
      registerCommands(makeContext() as unknown as import("vscode").ExtensionContext, deps);

      await vscodeMock._registeredCommands.get("openspec-ui.rollbackChange")?.(changeItem);

      expect(deps.implementationSessions.rollbackChange).not.toHaveBeenCalled();
    });

    it("reports conflicts as an error instead of refreshing trees", async () => {
      const deps = makeDeps();
      (deps.implementationSessions.changeRollbackDetails as ReturnType<typeof vi.fn>).mockReturnValue({
        processCount: 1,
        fileCount: 1,
      });
      (deps.implementationSessions.rollbackChange as ReturnType<typeof vi.fn>).mockResolvedValue({
        restored: [],
        conflicts: ["a.txt"],
      });
      vscodeMock.window.showWarningMessage.mockResolvedValue("Rollback");
      registerCommands(makeContext() as unknown as import("vscode").ExtensionContext, deps);

      await vscodeMock._registeredCommands.get("openspec-ui.rollbackChange")?.(changeItem);

      expect(vscodeMock.window.showErrorMessage).toHaveBeenCalledWith(
        expect.stringContaining("a.txt"),
      );
      expect(deps.refreshTrees).not.toHaveBeenCalled();
    });

    it("works the same for an archived change item", async () => {
      const deps = makeDeps();
      (deps.implementationSessions.changeRollbackDetails as ReturnType<typeof vi.fn>).mockReturnValue({
        processCount: 1,
        fileCount: 1,
      });
      (deps.implementationSessions.rollbackChange as ReturnType<typeof vi.fn>).mockResolvedValue({
        restored: ["a.txt"],
        conflicts: [],
      });
      vscodeMock.window.showWarningMessage.mockResolvedValue("Rollback");
      registerCommands(makeContext() as unknown as import("vscode").ExtensionContext, deps);

      await vscodeMock._registeredCommands.get("openspec-ui.rollbackChange")?.({
        changeName: "archived-change",
        archived: true,
      });

      expect(deps.implementationSessions.rollbackChange).toHaveBeenCalledWith("archived-change");
    });

    it("warns instead of silently doing nothing without a tree item", async () => {
      const deps = makeDeps();
      registerCommands(makeContext() as unknown as import("vscode").ExtensionContext, deps);

      await vscodeMock._registeredCommands.get("openspec-ui.rollbackChange")?.();

      expect(vscodeMock.window.showWarningMessage).toHaveBeenCalledWith(
        "OpenSpec UI: select a change in the Changes tree, or run this from its right-click menu.",
      );
      expect(deps.implementationSessions.rollbackChange).not.toHaveBeenCalled();
    });
  });

  it("openspec-ui.status: picks a change, runs direct OpenSpec status flow, and reveals the panel", async () => {
    listChangesMock.mockResolvedValue({
      changes: [{ name: "shared-ui", completedTasks: 1, totalTasks: 17, lastModified: "t", status: "in-progress" }],
      root: { path: "/workspace/repo", source: "nearest" },
    });
    vscodeMock.window.showQuickPick.mockResolvedValue({ label: "shared-ui", description: "1/17 — in-progress" });

    const deps = makeDeps();
    const runSpy = vi.spyOn(deps.runController, "run");
    const context = makeContext();
    registerCommands(context as unknown as import("vscode").ExtensionContext, deps);

    const handler = vscodeMock._registeredCommands.get("openspec-ui.status");
    await handler?.();

    expect(deps.revealAiPanel).toHaveBeenCalled();
    expect(runSpy).toHaveBeenCalledTimes(1);
    const [runnerArg, command] = runSpy.mock.calls[0]!;
    expect(runnerArg).toBeUndefined();
    expect(command).toMatchObject({
      kind: "status",
      cwd: "/workspace/repo",
      context: { changeDir: expect.stringContaining("shared-ui") },
    });
  });

  it("shows an error and does not run anything when no workspace is open", async () => {
    const deps = makeDeps({ getWorkspaceRoot: () => undefined });
    const runSpy = vi.spyOn(deps.runController, "run");
    registerCommands(makeContext() as unknown as import("vscode").ExtensionContext, deps);

    await vscodeMock._registeredCommands.get("openspec-ui.status")?.();

    expect(vscodeMock.window.showErrorMessage).toHaveBeenCalled();
    expect(runSpy).not.toHaveBeenCalled();
  });

  it("does nothing further when the user dismisses the QuickPick", async () => {
    listChangesMock.mockResolvedValue({
      changes: [{ name: "shared-ui", completedTasks: 1, totalTasks: 17, lastModified: "t", status: "in-progress" }],
      root: { path: "/workspace/repo", source: "nearest" },
    });
    vscodeMock.window.showQuickPick.mockResolvedValue(undefined);

    const deps = makeDeps();
    const runSpy = vi.spyOn(deps.runController, "run");
    registerCommands(makeContext() as unknown as import("vscode").ExtensionContext, deps);

    await vscodeMock._registeredCommands.get("openspec-ui.status")?.();

    expect(runSpy).not.toHaveBeenCalled();
  });

  it("openspec-ui.reviewDiff: warns when invoked without a tree item", async () => {
    registerCommands(makeContext() as unknown as import("vscode").ExtensionContext, makeDeps());
    await vscodeMock._registeredCommands.get("openspec-ui.reviewDiff")?.(undefined);
    expect(vscodeMock.window.showWarningMessage).toHaveBeenCalled();
    expect(openDiffAgainstHeadMock).not.toHaveBeenCalled();
  });

  it("opens the process dashboard with workspace context", async () => {
    const deps = makeDeps();
    registerCommands(makeContext() as unknown as import("vscode").ExtensionContext, deps);

    await vscodeMock._registeredCommands.get("openspec-ui.openAiPanel")?.();

    expect(deps.revealAiPanel).toHaveBeenCalledWith({
      cwd: "/workspace/repo",
      changeDir: expect.stringMatching(/workspace[\\/]repo[\\/]openspec[\\/]changes$/),
    });
  });

  it("opens the process dashboard with a selected change directory", async () => {
    const deps = makeDeps();
    registerCommands(makeContext() as unknown as import("vscode").ExtensionContext, deps);

    await vscodeMock._registeredCommands.get("openspec-ui.openAiPanel")?.({
      changeName: "shared-ui",
      changeDir: "/workspace/repo/openspec/changes/shared-ui",
    });

    expect(deps.revealAiPanel).toHaveBeenCalledWith({
      cwd: "/workspace/repo",
      changeDir: "/workspace/repo/openspec/changes/shared-ui",
    });
  });

  it("openspec-ui.reviewDiff: diffs tasks.md for the given change item", async () => {
    registerCommands(makeContext() as unknown as import("vscode").ExtensionContext, makeDeps());
    const item = { changeName: "shared-ui", changeDir: "/workspace/repo/openspec/changes/shared-ui" };
    await vscodeMock._registeredCommands.get("openspec-ui.reviewDiff")?.(item);

    expect(openDiffAgainstHeadMock).toHaveBeenCalledWith(
      expect.objectContaining({ fsPath: expect.stringContaining("tasks.md") }),
      expect.stringContaining("shared-ui"),
    );
  });

  it("openspec-ui.openspecView: opens terminal and runs openspec view", async () => {
    listChangesMock.mockResolvedValue({
      changes: [{ name: "shared-ui", completedTasks: 1, totalTasks: 17, lastModified: "2026-08-05T10:00:00.000Z", status: "in-progress" }],
      root: { path: "/workspace/repo", source: "nearest" },
    });
    listSpecsMock.mockResolvedValue({
      specs: [{ id: "shared-ui", requirementCount: 5 }],
      root: { path: "/workspace/repo", source: "nearest" },
    });

    registerCommands(makeContext() as unknown as import("vscode").ExtensionContext, makeDeps());
    await vscodeMock._registeredCommands.get("openspec-ui.openspecView")?.();

    expect(vscodeMock.window.createTerminal).toHaveBeenCalledWith(
      expect.objectContaining({ name: "OpenSpec UI: openspec view", cwd: "/workspace/repo" }),
    );
    const terminal = vscodeMock.window.createTerminal.mock.results[0]?.value;
    expect(terminal.show).toHaveBeenCalled();
    expect(terminal.sendText).toHaveBeenCalledWith("openspec view", true);
    expect(listChangesMock).toHaveBeenCalledWith({ cwd: "/workspace/repo" });
    expect(listSpecsMock).toHaveBeenCalledWith({ cwd: "/workspace/repo" });
    expect(vscodeMock.workspace.openTextDocument).toHaveBeenCalled();
  });

  it("openspec-ui.validateChangeStrict: opens a parsed markdown summary", async () => {
    listChangesMock.mockResolvedValue({
      changes: [{ name: "shared-ui", completedTasks: 1, totalTasks: 17, lastModified: "t", status: "in-progress" }],
      root: { path: "/workspace/repo", source: "nearest" },
    });
    vscodeMock.window.showQuickPick.mockResolvedValue({ label: "shared-ui", description: "1/17 — in-progress" });
    validateChangeMock.mockResolvedValue({
      items: [{ id: "shared-ui", type: "change", valid: true, issues: [], durationMs: 12 }],
      summary: { totals: { items: 1, passed: 1, failed: 0 }, byType: { change: { items: 1, passed: 1, failed: 0 } } },
      version: "1.2.3",
      root: { path: "/workspace/repo", source: "nearest" },
    });

    registerCommands(makeContext() as unknown as import("vscode").ExtensionContext, makeDeps());
    await vscodeMock._registeredCommands.get("openspec-ui.validateChangeStrict")?.();

    expect(validateChangeMock).toHaveBeenCalledWith("shared-ui", { cwd: "/workspace/repo" });
    expect(vscodeMock.workspace.openTextDocument).toHaveBeenCalled();
    expect(vscodeMock.window.showTextDocument).toHaveBeenCalled();
  });

  describe("openspec-ui.generateAgentInstructions", () => {
    it("writes both CLAUDE.md and AGENTS.md, opens both, on full success", async () => {
      vscodeMock.window.showQuickPick.mockResolvedValueOnce({ label: "Node.js / TypeScript", id: "node" });
      writeAgentInstructionsMock.mockResolvedValue({ claude: "created", agents: "created" });
      registerCommands(makeContext() as unknown as import("vscode").ExtensionContext, makeDeps());

      await vscodeMock._registeredCommands.get("openspec-ui.generateAgentInstructions")?.();

      expect(writeAgentInstructionsMock).toHaveBeenCalledWith("/workspace/repo", "node");
      expect(vscodeMock.window.showTextDocument).toHaveBeenCalledTimes(2);
      expect(vscodeMock.window.showWarningMessage).not.toHaveBeenCalled();
    });

    it("reports a foreign file as a warning without opening it, while still opening the other", async () => {
      vscodeMock.window.showQuickPick.mockResolvedValueOnce({ label: "Python", id: "python" });
      writeAgentInstructionsMock.mockResolvedValue({ claude: "skipped-foreign", agents: "created" });
      registerCommands(makeContext() as unknown as import("vscode").ExtensionContext, makeDeps());

      await vscodeMock._registeredCommands.get("openspec-ui.generateAgentInstructions")?.();

      expect(vscodeMock.window.showTextDocument).toHaveBeenCalledTimes(1);
      expect(vscodeMock.window.showWarningMessage).toHaveBeenCalledWith(
        expect.stringContaining("CLAUDE.md already exists"),
      );
    });

    it("does nothing when the project type picker is cancelled", async () => {
      vscodeMock.window.showQuickPick.mockResolvedValueOnce(undefined);
      registerCommands(makeContext() as unknown as import("vscode").ExtensionContext, makeDeps());

      await vscodeMock._registeredCommands.get("openspec-ui.generateAgentInstructions")?.();

      expect(writeAgentInstructionsMock).not.toHaveBeenCalled();
    });
  });

  describe("openspec-ui.configureHarness", () => {
    it("seeds the file with the documented default when it doesn't exist yet, then opens it", async () => {
      registerCommands(makeContext() as unknown as import("vscode").ExtensionContext, makeDeps());

      await vscodeMock._registeredCommands.get("openspec-ui.configureHarness")?.();

      expect(writeGlobalHarnessConfigMock).toHaveBeenCalledWith(
        "/workspace/repo",
        { stepAgents: {}, autonomyLevel: "assisted", reviewGate: { mode: "human-required" } },
      );
      expect(vscodeMock.window.showTextDocument).toHaveBeenCalledOnce();
    });

    it("opens the existing file without overwriting it", async () => {
      vscodeMock.workspace.fs.stat.mockResolvedValueOnce({});
      registerCommands(makeContext() as unknown as import("vscode").ExtensionContext, makeDeps());

      await vscodeMock._registeredCommands.get("openspec-ui.configureHarness")?.();

      expect(writeGlobalHarnessConfigMock).not.toHaveBeenCalled();
      expect(vscodeMock.window.showTextDocument).toHaveBeenCalledOnce();
    });

    it("does nothing without a workspace root", async () => {
      registerCommands(
        makeContext() as unknown as import("vscode").ExtensionContext,
        makeDeps({ getWorkspaceRoot: () => undefined }),
      );

      await vscodeMock._registeredCommands.get("openspec-ui.configureHarness")?.();

      expect(writeGlobalHarnessConfigMock).not.toHaveBeenCalled();
      expect(vscodeMock.window.showTextDocument).not.toHaveBeenCalled();
    });
  });

  describe("openspec-ui.configureHarnessForChange", () => {
    const changeItem = { changeName: "demo-change", changeDir: "/workspace/repo/openspec/changes/demo-change", archived: false };

    it("seeds an empty override (inherit everything) when none exists yet, then opens it", async () => {
      registerCommands(makeContext() as unknown as import("vscode").ExtensionContext, makeDeps());

      await vscodeMock._registeredCommands.get("openspec-ui.configureHarnessForChange")?.(changeItem);

      expect(writeChangeHarnessConfigMock).toHaveBeenCalledWith("/workspace/repo", "demo-change", {});
      expect(vscodeMock.window.showTextDocument).toHaveBeenCalledOnce();
    });

    it("opens an existing override without overwriting it", async () => {
      vscodeMock.workspace.fs.stat.mockResolvedValueOnce({});
      registerCommands(makeContext() as unknown as import("vscode").ExtensionContext, makeDeps());

      await vscodeMock._registeredCommands.get("openspec-ui.configureHarnessForChange")?.(changeItem);

      expect(writeChangeHarnessConfigMock).not.toHaveBeenCalled();
      expect(vscodeMock.window.showTextDocument).toHaveBeenCalledOnce();
    });

    it("warns instead of silently doing nothing without a tree item (invoked outside the context menu)", async () => {
      registerCommands(makeContext() as unknown as import("vscode").ExtensionContext, makeDeps());

      await vscodeMock._registeredCommands.get("openspec-ui.configureHarnessForChange")?.();

      expect(vscodeMock.window.showWarningMessage).toHaveBeenCalledWith(
        "OpenSpec UI: select a change in the Changes tree, or run this from its right-click menu.",
      );
      expect(writeChangeHarnessConfigMock).not.toHaveBeenCalled();
      expect(vscodeMock.window.showTextDocument).not.toHaveBeenCalled();
    });
  });

  describe("openspec-ui.runWithHarness", () => {
    const changeItem = { changeName: "demo-change", changeDir: "/workspace/repo/openspec/changes/demo-change", archived: false };

    it("resolves the change's harness config fresh and reveals the picker for assisted", async () => {
      const resolvedConfig = { stepAgents: {}, autonomyLevel: "assisted", reviewGate: { mode: "human-required" } };
      resolveHarnessConfigMock.mockResolvedValue(resolvedConfig);
      resolveRunWithHarnessTargetMock.mockReturnValue("picker");
      const deps = makeDeps();
      registerCommands(makeContext() as unknown as import("vscode").ExtensionContext, deps);

      await vscodeMock._registeredCommands.get("openspec-ui.runWithHarness")?.(changeItem);

      expect(resolveHarnessConfigMock).toHaveBeenCalledWith("/workspace/repo", "demo-change");
      expect(resolveRunWithHarnessTargetMock).toHaveBeenCalledWith(resolvedConfig);
      expect(deps.revealAiPanel).toHaveBeenCalledWith({
        cwd: "/workspace/repo",
        changeDir: "/workspace/repo/openspec/changes/demo-change",
        startChain: false,
      });
    });

    it("reveals with startChain: true when the resolved target is chain", async () => {
      resolveHarnessConfigMock.mockResolvedValue({ stepAgents: {}, autonomyLevel: "autonomous", reviewGate: { mode: "human-required" } });
      resolveRunWithHarnessTargetMock.mockReturnValue("chain");
      const deps = makeDeps();
      registerCommands(makeContext() as unknown as import("vscode").ExtensionContext, deps);

      await vscodeMock._registeredCommands.get("openspec-ui.runWithHarness")?.(changeItem);

      expect(deps.revealAiPanel).toHaveBeenCalledWith(expect.objectContaining({ startChain: true }));
    });

    it("does nothing for an archived change", async () => {
      const deps = makeDeps();
      registerCommands(makeContext() as unknown as import("vscode").ExtensionContext, deps);

      await vscodeMock._registeredCommands.get("openspec-ui.runWithHarness")?.({ ...changeItem, archived: true });

      expect(resolveHarnessConfigMock).not.toHaveBeenCalled();
      expect(deps.revealAiPanel).not.toHaveBeenCalled();
    });

    it("warns instead of silently doing nothing without a tree item (invoked outside the context menu)", async () => {
      const deps = makeDeps();
      registerCommands(makeContext() as unknown as import("vscode").ExtensionContext, deps);

      await vscodeMock._registeredCommands.get("openspec-ui.runWithHarness")?.();

      expect(vscodeMock.window.showWarningMessage).toHaveBeenCalledWith(
        "OpenSpec UI: select a change in the Changes tree, or run this from its right-click menu.",
      );
      expect(resolveHarnessConfigMock).not.toHaveBeenCalled();
      expect(deps.revealAiPanel).not.toHaveBeenCalled();
    });

    it("reports a resolution failure instead of throwing", async () => {
      resolveHarnessConfigMock.mockRejectedValue(new Error("bad harness config"));
      const deps = makeDeps();
      registerCommands(makeContext() as unknown as import("vscode").ExtensionContext, deps);

      await vscodeMock._registeredCommands.get("openspec-ui.runWithHarness")?.(changeItem);

      expect(vscodeMock.window.showErrorMessage).toHaveBeenCalled();
      expect(deps.revealAiPanel).not.toHaveBeenCalled();
    });
  });

  describe("openspec-ui.configureDependabot", () => {
    it("writes the file for the selected project types and opens it", async () => {
      vscodeMock.window.showQuickPick.mockResolvedValueOnce([
        { label: "Node.js / TypeScript", id: "node" },
        { label: "Python", id: "python" },
      ]);
      writeDependabotConfigMock.mockResolvedValue("created");
      registerCommands(makeContext() as unknown as import("vscode").ExtensionContext, makeDeps());

      await vscodeMock._registeredCommands.get("openspec-ui.configureDependabot")?.();

      expect(writeDependabotConfigMock).toHaveBeenCalledWith("/workspace/repo", ["node", "python"]);
      expect(vscodeMock.window.showTextDocument).toHaveBeenCalled();
    });

    it("reports a foreign dependabot.yml as a warning and does not open it", async () => {
      vscodeMock.window.showQuickPick.mockResolvedValueOnce([{ label: "Node.js / TypeScript", id: "node" }]);
      writeDependabotConfigMock.mockResolvedValue("skipped-foreign");
      registerCommands(makeContext() as unknown as import("vscode").ExtensionContext, makeDeps());

      await vscodeMock._registeredCommands.get("openspec-ui.configureDependabot")?.();

      expect(vscodeMock.window.showTextDocument).not.toHaveBeenCalled();
      expect(vscodeMock.window.showWarningMessage).toHaveBeenCalledWith(
        expect.stringContaining("dependabot.yml already exists"),
      );
    });
  });

  describe("openspec-ui.generateSubtypeInstructions", () => {
    it("prompts for project type then subtype, writes the file, and opens it", async () => {
      vscodeMock.window.showQuickPick
        .mockResolvedValueOnce({ label: "Node.js / TypeScript", id: "node" })
        .mockResolvedValueOnce({ label: "backend", id: "backend" });
      writeSubtypeInstructionsMock.mockResolvedValue("created");
      registerCommands(makeContext() as unknown as import("vscode").ExtensionContext, makeDeps());

      await vscodeMock._registeredCommands.get("openspec-ui.generateSubtypeInstructions")?.();

      expect(writeSubtypeInstructionsMock).toHaveBeenCalledWith("/workspace/repo", "node", "backend");
      expect(vscodeMock.window.showTextDocument).toHaveBeenCalled();
    });

    it("does nothing when the subtype picker is cancelled after a project type was picked", async () => {
      vscodeMock.window.showQuickPick
        .mockResolvedValueOnce({ label: "Python", id: "python" })
        .mockResolvedValueOnce(undefined);
      registerCommands(makeContext() as unknown as import("vscode").ExtensionContext, makeDeps());

      await vscodeMock._registeredCommands.get("openspec-ui.generateSubtypeInstructions")?.();

      expect(writeSubtypeInstructionsMock).not.toHaveBeenCalled();
    });
  });

  describe("openspec-ui.copyTasksAsTemplate", () => {
    it("inserts the archived change's tasks template into the picked target's tasks.md", async () => {
      listChangesMock.mockResolvedValue({
        changes: [{ name: "active-change", completedTasks: 0, totalTasks: 3, lastModified: "t", status: "draft" }],
        root: { path: "/workspace/repo", source: "nearest" },
      });
      vscodeMock.window.showQuickPick.mockResolvedValue({ label: "active-change", description: "0/3 — draft" });
      readArchivedChangeTasksTemplateMock.mockResolvedValue("## 1. From archive\n\n- [ ] step\n");
      const targetPath = path.join("/workspace/repo", "openspec", "changes", "active-change", "tasks.md");
      vscodeMock._documentContents.set(targetPath, "## 1. Existing\n\n- [ ] already here\n");

      registerCommands(makeContext() as unknown as import("vscode").ExtensionContext, makeDeps());
      await vscodeMock._registeredCommands.get("openspec-ui.copyTasksAsTemplate")?.({
        changeName: "old-change",
        archived: true,
      });

      expect(readArchivedChangeTasksTemplateMock).toHaveBeenCalledWith("/workspace/repo", "old-change");
      expect(vscodeMock.workspace.applyEdit).toHaveBeenCalled();
      expect(vscodeMock._documentContents.get(targetPath)).toBe(
        "## 1. Existing\n\n- [ ] already here\n\n## 1. From archive\n\n- [ ] step\n",
      );
      expect(vscodeMock.window.showTextDocument).toHaveBeenCalled();
    });

    it("does nothing when invoked on a non-archived item", async () => {
      registerCommands(makeContext() as unknown as import("vscode").ExtensionContext, makeDeps());

      await vscodeMock._registeredCommands.get("openspec-ui.copyTasksAsTemplate")?.({
        changeName: "active-change",
        archived: false,
      });

      expect(vscodeMock.window.showQuickPick).not.toHaveBeenCalled();
      expect(readArchivedChangeTasksTemplateMock).not.toHaveBeenCalled();
    });

    it("warns instead of silently doing nothing without a tree item", async () => {
      registerCommands(makeContext() as unknown as import("vscode").ExtensionContext, makeDeps());

      await vscodeMock._registeredCommands.get("openspec-ui.copyTasksAsTemplate")?.();

      expect(vscodeMock.window.showWarningMessage).toHaveBeenCalledWith(
        "OpenSpec UI: select a change in the Changes tree, or run this from its right-click menu.",
      );
      expect(readArchivedChangeTasksTemplateMock).not.toHaveBeenCalled();
    });

    it("reports no valid target instead of offering an empty picker", async () => {
      listChangesMock.mockResolvedValue({ changes: [], root: { path: "/workspace/repo", source: "nearest" } });

      registerCommands(makeContext() as unknown as import("vscode").ExtensionContext, makeDeps());
      await vscodeMock._registeredCommands.get("openspec-ui.copyTasksAsTemplate")?.({
        changeName: "old-change",
        archived: true,
      });

      expect(vscodeMock.window.showWarningMessage).toHaveBeenCalledWith(
        expect.stringContaining("no changes found"),
      );
      expect(readArchivedChangeTasksTemplateMock).not.toHaveBeenCalled();
    });

    it("does nothing when the user dismisses the target picker", async () => {
      listChangesMock.mockResolvedValue({
        changes: [{ name: "active-change", completedTasks: 0, totalTasks: 3, lastModified: "t", status: "draft" }],
        root: { path: "/workspace/repo", source: "nearest" },
      });
      vscodeMock.window.showQuickPick.mockResolvedValue(undefined);

      registerCommands(makeContext() as unknown as import("vscode").ExtensionContext, makeDeps());
      await vscodeMock._registeredCommands.get("openspec-ui.copyTasksAsTemplate")?.({
        changeName: "old-change",
        archived: true,
      });

      expect(readArchivedChangeTasksTemplateMock).not.toHaveBeenCalled();
    });
  });

  describe("openspec-ui.customizeTemplate", () => {
    const builtInItem = {
      template: {
        origin: "built-in" as const,
        manifest: { id: "seed", title: "Seed", category: "c", version: "1.0.0", summary: "s", variables: [] },
      },
    };

    it("customizes a built-in template, refreshes the templates tree, and opens the created manifest", async () => {
      customizeTemplateMock.mockResolvedValue({});
      const deps = makeDeps();
      registerCommands(makeContext() as unknown as import("vscode").ExtensionContext, deps);

      await vscodeMock._registeredCommands.get("openspec-ui.customizeTemplate")?.(builtInItem);

      expect(customizeTemplateMock).toHaveBeenCalledWith("/workspace/repo", "seed");
      expect(deps.refreshTemplatesTree).toHaveBeenCalled();
      const manifestPath = path.join("/workspace/repo", "openspec", "templates", "seed", "template.json");
      expect(vscodeMock.workspace.openTextDocument).toHaveBeenCalledWith(expect.objectContaining({ fsPath: manifestPath }));
      expect(vscodeMock.window.showTextDocument).toHaveBeenCalled();
    });

    it("reports an already-customized template as a warning, not an error", async () => {
      customizeTemplateMock.mockRejectedValue(new TemplateAlreadyExistsError("already exists"));
      registerCommands(makeContext() as unknown as import("vscode").ExtensionContext, makeDeps());

      await vscodeMock._registeredCommands.get("openspec-ui.customizeTemplate")?.(builtInItem);

      expect(vscodeMock.window.showWarningMessage).toHaveBeenCalled();
      expect(vscodeMock.window.showErrorMessage).not.toHaveBeenCalled();
    });

    it("does nothing for a project-level template", async () => {
      registerCommands(makeContext() as unknown as import("vscode").ExtensionContext, makeDeps());

      await vscodeMock._registeredCommands.get("openspec-ui.customizeTemplate")?.({
        template: { ...builtInItem.template, origin: "project" as const },
      });

      expect(customizeTemplateMock).not.toHaveBeenCalled();
    });

    it("warns instead of silently doing nothing without a tree item", async () => {
      registerCommands(makeContext() as unknown as import("vscode").ExtensionContext, makeDeps());

      await vscodeMock._registeredCommands.get("openspec-ui.customizeTemplate")?.();

      expect(vscodeMock.window.showWarningMessage).toHaveBeenCalledWith(
        "OpenSpec UI: select a template in the Templates tree, or run this from its right-click menu.",
      );
      expect(customizeTemplateMock).not.toHaveBeenCalled();
    });
  });

  describe("openspec-ui.deleteProjectTemplate", () => {
    const projectItem = {
      template: {
        origin: "project" as const,
        manifest: { id: "seed", title: "Seed", category: "c", version: "1.0.0", summary: "s", variables: [] },
      },
    };

    it("deletes a project template after confirmation and refreshes the templates tree", async () => {
      vscodeMock.window.showWarningMessage.mockResolvedValue("Delete");
      const deps = makeDeps();
      registerCommands(makeContext() as unknown as import("vscode").ExtensionContext, deps);

      await vscodeMock._registeredCommands.get("openspec-ui.deleteProjectTemplate")?.(projectItem);

      expect(deleteProjectTemplateMock).toHaveBeenCalledWith("/workspace/repo", "seed");
      expect(deps.refreshTemplatesTree).toHaveBeenCalled();
    });

    it("does not delete when the confirmation is declined", async () => {
      vscodeMock.window.showWarningMessage.mockResolvedValue(undefined);
      registerCommands(makeContext() as unknown as import("vscode").ExtensionContext, makeDeps());

      await vscodeMock._registeredCommands.get("openspec-ui.deleteProjectTemplate")?.(projectItem);

      expect(deleteProjectTemplateMock).not.toHaveBeenCalled();
    });

    it("does nothing for a built-in template", async () => {
      registerCommands(makeContext() as unknown as import("vscode").ExtensionContext, makeDeps());

      await vscodeMock._registeredCommands.get("openspec-ui.deleteProjectTemplate")?.({
        template: { ...projectItem.template, origin: "built-in" as const },
      });

      expect(deleteProjectTemplateMock).not.toHaveBeenCalled();
    });

    it("warns instead of silently doing nothing without a tree item", async () => {
      registerCommands(makeContext() as unknown as import("vscode").ExtensionContext, makeDeps());

      await vscodeMock._registeredCommands.get("openspec-ui.deleteProjectTemplate")?.();

      expect(vscodeMock.window.showWarningMessage).toHaveBeenCalledWith(
        "OpenSpec UI: select a template in the Templates tree, or run this from its right-click menu.",
      );
      expect(deleteProjectTemplateMock).not.toHaveBeenCalled();
    });

    it("reports an unknown template id as a warning, not an error", async () => {
      vscodeMock.window.showWarningMessage.mockResolvedValueOnce("Delete");
      deleteProjectTemplateMock.mockRejectedValue(new UnknownProjectTemplateError("Unknown project-level template: seed"));
      registerCommands(makeContext() as unknown as import("vscode").ExtensionContext, makeDeps());

      await vscodeMock._registeredCommands.get("openspec-ui.deleteProjectTemplate")?.(projectItem);

      expect(vscodeMock.window.showWarningMessage).toHaveBeenCalledTimes(2);
      expect(vscodeMock.window.showErrorMessage).not.toHaveBeenCalled();
    });
  });

  describe("openspec-ui.revealTask", () => {
    const changeDir = path.join("/workspace/repo", "openspec", "changes", "active-change");
    const tasksPath = path.join(changeDir, "tasks.md");
    const taskItem = {
      changeName: "active-change",
      changeDir,
      archived: false,
      lineNumber: 2,
      text: "1.1 First task",
      done: false,
    };

    it("opens tasks.md and reveals the exact line when the stored line number is still correct", async () => {
      vscodeMock._documentContents.set(tasksPath, "## 1. Setup\n\n- [ ] 1.1 First task\n- [ ] 1.2 Second task\n");
      registerCommands(makeContext() as unknown as import("vscode").ExtensionContext, makeDeps());

      await vscodeMock._registeredCommands.get("openspec-ui.revealTask")?.(taskItem);

      expect(vscodeMock.window.showTextDocument).toHaveBeenCalledWith(
        expect.objectContaining({ uri: expect.objectContaining({ fsPath: tasksPath }) }),
        { preview: false },
      );
      const editor = await vscodeMock.window.showTextDocument.mock.results[0]?.value;
      expect(editor.revealRange).toHaveBeenCalledWith(
        expect.objectContaining({ start: { line: 2, character: 0 } }),
        vscodeMock.TextEditorRevealType.InCenter,
      );
      expect(editor.selection).toBeInstanceOf(vscodeMock.Selection);
    });

    it("falls back to searching the whole file when the stored line number is stale", async () => {
      // Text is on line 3 now, not the stored lineNumber 2 (e.g. a line was
      // inserted above it since the tree was last refreshed).
      vscodeMock._documentContents.set(tasksPath, "## 1. Setup\n\n- [ ] Unrelated\n- [ ] 1.1 First task\n");
      registerCommands(makeContext() as unknown as import("vscode").ExtensionContext, makeDeps());

      await vscodeMock._registeredCommands.get("openspec-ui.revealTask")?.(taskItem);

      const editor = await vscodeMock.window.showTextDocument.mock.results[0]?.value;
      expect(editor.revealRange).toHaveBeenCalledWith(
        expect.objectContaining({ start: { line: 3, character: 0 } }),
        vscodeMock.TextEditorRevealType.InCenter,
      );
    });
  });

  describe("openspec-ui.deleteTask", () => {
    const activeItem = {
      changeName: "active-change",
      changeDir: path.join("/workspace/repo", "openspec", "changes", "active-change"),
      archived: false,
      lineNumber: 2,
      text: "1.1 First task",
      done: false,
    };

    it("deletes a task after confirmation and refreshes trees", async () => {
      vscodeMock.window.showWarningMessage.mockResolvedValue("Delete");
      const deps = makeDeps();
      registerCommands(makeContext() as unknown as import("vscode").ExtensionContext, deps);

      await vscodeMock._registeredCommands.get("openspec-ui.deleteTask")?.(activeItem);

      expect(deleteTaskLineMock).toHaveBeenCalledWith("/workspace/repo", "active-change", false, 2, "1.1 First task");
      expect(deps.refreshTrees).toHaveBeenCalled();
    });

    it("does not delete when the confirmation is declined", async () => {
      vscodeMock.window.showWarningMessage.mockResolvedValue(undefined);
      registerCommands(makeContext() as unknown as import("vscode").ExtensionContext, makeDeps());

      await vscodeMock._registeredCommands.get("openspec-ui.deleteTask")?.(activeItem);

      expect(deleteTaskLineMock).not.toHaveBeenCalled();
    });

    it("does nothing for an archived task, without even prompting", async () => {
      registerCommands(makeContext() as unknown as import("vscode").ExtensionContext, makeDeps());

      await vscodeMock._registeredCommands.get("openspec-ui.deleteTask")?.({ ...activeItem, archived: true });

      expect(vscodeMock.window.showWarningMessage).not.toHaveBeenCalled();
      expect(deleteTaskLineMock).not.toHaveBeenCalled();
    });

    it("does nothing for a done task, even in an active change, without even prompting", async () => {
      registerCommands(makeContext() as unknown as import("vscode").ExtensionContext, makeDeps());

      await vscodeMock._registeredCommands.get("openspec-ui.deleteTask")?.({ ...activeItem, done: true });

      expect(vscodeMock.window.showWarningMessage).not.toHaveBeenCalled();
      expect(deleteTaskLineMock).not.toHaveBeenCalled();
    });

    it("reports a stale task list as a warning, not an error", async () => {
      vscodeMock.window.showWarningMessage.mockResolvedValueOnce("Delete");
      deleteTaskLineMock.mockRejectedValue(new TaskListChangedError("task list changed"));
      registerCommands(makeContext() as unknown as import("vscode").ExtensionContext, makeDeps());

      await vscodeMock._registeredCommands.get("openspec-ui.deleteTask")?.(activeItem);

      expect(vscodeMock.window.showWarningMessage).toHaveBeenCalledTimes(2);
      expect(vscodeMock.window.showErrorMessage).not.toHaveBeenCalled();
    });

    it("warns instead of silently doing nothing without a tree item", async () => {
      registerCommands(makeContext() as unknown as import("vscode").ExtensionContext, makeDeps());

      await vscodeMock._registeredCommands.get("openspec-ui.deleteTask")?.();

      expect(vscodeMock.window.showWarningMessage).toHaveBeenCalledWith(
        "OpenSpec UI: select a task in the Changes tree, or run this from its right-click menu.",
      );
      expect(deleteTaskLineMock).not.toHaveBeenCalled();
    });
  });

  describe("openspec-ui.insertTemplateIntoChange", () => {
    const templateItem = {
      template: {
        origin: "built-in" as const,
        manifest: {
          id: "seed",
          title: "Seed",
          category: "c",
          version: "1.0.0",
          summary: "s",
          variables: [{ name: "packageName", prompt: "Package name?", default: "app" }],
        },
      },
    };

    it("prompts for variables, renders, and inserts into all three artifact files", async () => {
      listChangesMock.mockResolvedValue({
        changes: [{ name: "active-change", completedTasks: 0, totalTasks: 3, lastModified: "t", status: "draft" }],
        root: { path: "/workspace/repo", source: "nearest" },
      });
      vscodeMock.window.showQuickPick.mockResolvedValue({ label: "active-change", description: "0/3 — draft" });
      vscodeMock.window.showInputBox.mockResolvedValue("myapp");
      renderTemplateMock.mockReturnValue({ proposal: "P body", design: "D body", tasks: "T body" });

      const changeDir = path.join("/workspace/repo", "openspec", "changes", "active-change");
      vscodeMock._documentContents.set(path.join(changeDir, "proposal.md"), "");
      vscodeMock._documentContents.set(path.join(changeDir, "design.md"), "");
      vscodeMock._documentContents.set(path.join(changeDir, "tasks.md"), "## 1. Existing\n");

      registerCommands(makeContext() as unknown as import("vscode").ExtensionContext, makeDeps());
      await vscodeMock._registeredCommands.get("openspec-ui.insertTemplateIntoChange")?.(templateItem);

      expect(vscodeMock.window.showInputBox).toHaveBeenCalledWith(
        expect.objectContaining({ title: "Package name?", value: "app" }),
      );
      expect(renderTemplateMock).toHaveBeenCalledWith(templateItem.template, { packageName: "myapp" });
      expect(vscodeMock._documentContents.get(path.join(changeDir, "proposal.md"))).toBe("P body");
      expect(vscodeMock._documentContents.get(path.join(changeDir, "design.md"))).toBe("D body");
      expect(vscodeMock._documentContents.get(path.join(changeDir, "tasks.md"))).toBe("## 1. Existing\n\nT body");
      expect(vscodeMock.window.showTextDocument).toHaveBeenCalled();
    });

    it("does nothing when the variable prompt is dismissed", async () => {
      listChangesMock.mockResolvedValue({
        changes: [{ name: "active-change", completedTasks: 0, totalTasks: 3, lastModified: "t", status: "draft" }],
        root: { path: "/workspace/repo", source: "nearest" },
      });
      vscodeMock.window.showQuickPick.mockResolvedValue({ label: "active-change", description: "0/3 — draft" });
      vscodeMock.window.showInputBox.mockResolvedValue(undefined);

      registerCommands(makeContext() as unknown as import("vscode").ExtensionContext, makeDeps());
      await vscodeMock._registeredCommands.get("openspec-ui.insertTemplateIntoChange")?.(templateItem);

      expect(renderTemplateMock).not.toHaveBeenCalled();
    });

    it("prompts boolean-typed variables via a Yes/No QuickPick", async () => {
      const booleanItem = {
        template: {
          origin: "built-in" as const,
          manifest: {
            id: "seed-bool",
            title: "Seed Bool",
            category: "c",
            version: "1.0.0",
            summary: "s",
            variables: [{ name: "includeTests", prompt: "Include tests?", type: "boolean" as const }],
          },
        },
      };
      listChangesMock.mockResolvedValue({
        changes: [{ name: "active-change", completedTasks: 0, totalTasks: 3, lastModified: "t", status: "draft" }],
        root: { path: "/workspace/repo", source: "nearest" },
      });
      vscodeMock.window.showQuickPick
        .mockResolvedValueOnce({ label: "active-change", description: "0/3 — draft" })
        .mockResolvedValueOnce("Yes");
      renderTemplateMock.mockReturnValue({ proposal: "", design: "", tasks: "" });
      const changeDir = path.join("/workspace/repo", "openspec", "changes", "active-change");
      vscodeMock._documentContents.set(path.join(changeDir, "proposal.md"), "");
      vscodeMock._documentContents.set(path.join(changeDir, "design.md"), "");
      vscodeMock._documentContents.set(path.join(changeDir, "tasks.md"), "");

      registerCommands(makeContext() as unknown as import("vscode").ExtensionContext, makeDeps());
      await vscodeMock._registeredCommands.get("openspec-ui.insertTemplateIntoChange")?.(booleanItem);

      expect(renderTemplateMock).toHaveBeenCalledWith(booleanItem.template, { includeTests: true });
    });

    it("warns instead of silently doing nothing without a tree item", async () => {
      registerCommands(makeContext() as unknown as import("vscode").ExtensionContext, makeDeps());

      await vscodeMock._registeredCommands.get("openspec-ui.insertTemplateIntoChange")?.();

      expect(vscodeMock.window.showWarningMessage).toHaveBeenCalledWith(
        "OpenSpec UI: select a template in the Templates tree, or run this from its right-click menu.",
      );
      expect(renderTemplateMock).not.toHaveBeenCalled();
    });
  });

  describe("openspec-ui.revealTask", () => {
    it("warns instead of silently doing nothing without a tree item", async () => {
      registerCommands(makeContext() as unknown as import("vscode").ExtensionContext, makeDeps());

      await vscodeMock._registeredCommands.get("openspec-ui.revealTask")?.();

      expect(vscodeMock.window.showWarningMessage).toHaveBeenCalledWith(
        "OpenSpec UI: select a task in the Changes tree, or run this from its right-click menu.",
      );
      expect(vscodeMock.window.showTextDocument).not.toHaveBeenCalled();
    });
  });

  describe("openspec-ui.startImplementation", () => {
    it("starts an implementation session for the given change", async () => {
      const deps = makeDeps();
      registerCommands(makeContext() as unknown as import("vscode").ExtensionContext, deps);

      await vscodeMock._registeredCommands.get("openspec-ui.startImplementation")?.({
        changeName: "demo-change",
        changeDir: "/workspace/repo/openspec/changes/demo-change",
        archived: false,
      });

      expect(deps.implementationSessions.start).toHaveBeenCalledWith("/workspace/repo", "demo-change");
    });

    it("does nothing for an archived change", async () => {
      const deps = makeDeps();
      registerCommands(makeContext() as unknown as import("vscode").ExtensionContext, deps);

      await vscodeMock._registeredCommands.get("openspec-ui.startImplementation")?.({
        changeName: "demo-change",
        changeDir: "/workspace/repo/openspec/changes/demo-change",
        archived: true,
      });

      expect(deps.implementationSessions.start).not.toHaveBeenCalled();
    });

    it("warns instead of silently doing nothing without a tree item", async () => {
      const deps = makeDeps();
      registerCommands(makeContext() as unknown as import("vscode").ExtensionContext, deps);

      await vscodeMock._registeredCommands.get("openspec-ui.startImplementation")?.();

      expect(vscodeMock.window.showWarningMessage).toHaveBeenCalledWith(
        "OpenSpec UI: select a change in the Changes tree, or run this from its right-click menu.",
      );
      expect(deps.implementationSessions.start).not.toHaveBeenCalled();
    });

    it("warns instead of silently doing nothing without a workspace", async () => {
      const deps = makeDeps({ getWorkspaceRoot: () => undefined });
      registerCommands(makeContext() as unknown as import("vscode").ExtensionContext, deps);

      await vscodeMock._registeredCommands.get("openspec-ui.startImplementation")?.({
        changeName: "demo-change",
        changeDir: "/workspace/repo/openspec/changes/demo-change",
        archived: false,
      });

      expect(vscodeMock.window.showErrorMessage).toHaveBeenCalledWith(
        "OpenSpec UI: open a folder or workspace first.",
      );
      expect(deps.implementationSessions.start).not.toHaveBeenCalled();
    });
  });


  // The Command Palette invokes a command with no item — only the tree's
  // own right-click menu passes one — so the row the user highlighted has
  // to stand in for it. See openspec/changes/tree-command-selection-fallback.
  describe("tree selection fallback", () => {
    const activeChangeRow = {
      changeName: "selected-change",
      changeDir: "/workspace/repo/openspec/changes/selected-change",
      archived: false,
      contextValue: "openspec-ui.activeChange",
    };
    const archivedChangeRow = {
      changeName: "selected-archived-change",
      changeDir: "/workspace/repo/openspec/changes/archive/selected-archived-change",
      archived: true,
      contextValue: "openspec-ui.archivedChange",
    };
    const taskRow = {
      changeName: "selected-change",
      changeDir: "/workspace/repo/openspec/changes/selected-change",
      archived: false,
      lineNumber: 3,
      text: "1.1 Do the thing",
      done: false,
      contextValue: "openspec-ui.activeTask",
    };
    const templateRow = {
      template: { origin: "project", manifest: { id: "selected-template", title: "Selected Template" } },
      contextValue: "openspec-ui.projectTemplate",
    };
    const noChangeSelectionWarning =
      "OpenSpec UI: select a change in the Changes tree, or run this from its right-click menu.";

    it("acts on the sole selected row when invoked without an item", async () => {
      vscodeMock.window.showWarningMessage.mockResolvedValue("Archive");
      archiveChangeMock.mockResolvedValue({ ok: true });
      checkChangesetReminderMock.mockResolvedValue({ changesetsAdopted: false, pendingChangesetCount: 0 });
      const deps = makeDeps({ changesView: { selection: [activeChangeRow] } });
      registerCommands(makeContext() as unknown as import("vscode").ExtensionContext, deps);

      await vscodeMock._registeredCommands.get("openspec-ui.archiveChange")?.();

      expect(archiveChangeMock).toHaveBeenCalledWith("selected-change", { cwd: "/workspace/repo" });
    });

    it("refuses to guess when several rows are selected", async () => {
      const deps = makeDeps({
        changesView: { selection: [activeChangeRow, { ...activeChangeRow, changeName: "other-change" }] },
      });
      registerCommands(makeContext() as unknown as import("vscode").ExtensionContext, deps);

      await vscodeMock._registeredCommands.get("openspec-ui.archiveChange")?.();

      expect(vscodeMock.window.showWarningMessage).toHaveBeenCalledWith(noChangeSelectionWarning);
      expect(archiveChangeMock).not.toHaveBeenCalled();
    });

    it("warns when nothing is selected anywhere", async () => {
      registerCommands(makeContext() as unknown as import("vscode").ExtensionContext, makeDeps());

      await vscodeMock._registeredCommands.get("openspec-ui.archiveChange")?.();

      expect(vscodeMock.window.showWarningMessage).toHaveBeenCalledWith(noChangeSelectionWarning);
      expect(archiveChangeMock).not.toHaveBeenCalled();
    });

    it("warns when the sole selected row is of another kind", async () => {
      const deps = makeDeps({ changesView: { selection: [taskRow] } });
      registerCommands(makeContext() as unknown as import("vscode").ExtensionContext, deps);

      await vscodeMock._registeredCommands.get("openspec-ui.archiveChange")?.();

      expect(vscodeMock.window.showWarningMessage).toHaveBeenCalledWith(noChangeSelectionWarning);
      expect(archiveChangeMock).not.toHaveBeenCalled();
    });

    it("resolves unarchiveChange from the Archive tree, not the Changes tree", async () => {
      vscodeMock.window.showWarningMessage.mockResolvedValue("Unarchive");
      const deps = makeDeps({
        changesView: { selection: [activeChangeRow] },
        archiveView: { selection: [archivedChangeRow] },
      });
      registerCommands(makeContext() as unknown as import("vscode").ExtensionContext, deps);

      await vscodeMock._registeredCommands.get("openspec-ui.unarchiveChange")?.();

      expect(unarchiveChangeMock).toHaveBeenCalledWith("/workspace/repo", "selected-archived-change");
    });

    it("resolves a template command from the Templates tree", async () => {
      vscodeMock.window.showWarningMessage.mockResolvedValue("Delete");
      const deps = makeDeps({ templatesView: { selection: [templateRow] } });
      registerCommands(makeContext() as unknown as import("vscode").ExtensionContext, deps);

      await vscodeMock._registeredCommands.get("openspec-ui.deleteProjectTemplate")?.();

      expect(deleteProjectTemplateMock).toHaveBeenCalledWith("/workspace/repo", "selected-template");
    });

    it("resolves a task command from the Changes tree", async () => {
      vscodeMock.window.showWarningMessage.mockResolvedValue("Delete");
      const deps = makeDeps({ changesView: { selection: [taskRow] } });
      registerCommands(makeContext() as unknown as import("vscode").ExtensionContext, deps);

      await vscodeMock._registeredCommands.get("openspec-ui.deleteTask")?.();

      expect(deleteTaskLineMock).toHaveBeenCalledWith(
        "/workspace/repo",
        "selected-change",
        false,
        3,
        "1.1 Do the thing",
      );
    });

    it("prefers an explicitly passed item over the selection", async () => {
      vscodeMock.window.showWarningMessage.mockResolvedValue("Archive");
      archiveChangeMock.mockResolvedValue({ ok: true });
      checkChangesetReminderMock.mockResolvedValue({ changesetsAdopted: false, pendingChangesetCount: 0 });
      const deps = makeDeps({ changesView: { selection: [activeChangeRow] } });
      registerCommands(makeContext() as unknown as import("vscode").ExtensionContext, deps);

      await vscodeMock._registeredCommands.get("openspec-ui.archiveChange")?.({
        changeName: "clicked-change",
        archived: false,
      });

      expect(archiveChangeMock).toHaveBeenCalledWith("clicked-change", { cwd: "/workspace/repo" });
    });
  });

  it("openspec-ui.createChange: shows the exact pre-existing no-workspace message via the shared helper", async () => {
    const deps = makeDeps({ getWorkspaceRoot: () => undefined });
    registerCommands(makeContext() as unknown as import("vscode").ExtensionContext, deps);

    await vscodeMock._registeredCommands.get("openspec-ui.createChange")?.();

    expect(vscodeMock.window.showErrorMessage).toHaveBeenCalledWith(
      "OpenSpec UI: open a folder or workspace first.",
    );
    expect(createChangeMock).not.toHaveBeenCalled();
  });

  it("openspec-ui.openAiPanel: shows the exact pre-existing no-workspace message via the shared helper", async () => {
    const deps = makeDeps({ getWorkspaceRoot: () => undefined });
    registerCommands(makeContext() as unknown as import("vscode").ExtensionContext, deps);

    await vscodeMock._registeredCommands.get("openspec-ui.openAiPanel")?.();

    expect(vscodeMock.window.showErrorMessage).toHaveBeenCalledWith(
      "OpenSpec UI: open a folder or workspace first.",
    );
    expect(deps.revealAiPanel).not.toHaveBeenCalled();
  });
});
