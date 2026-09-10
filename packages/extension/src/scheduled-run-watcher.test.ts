import { afterEach, describe, expect, it, vi } from "vitest";
import { createVscodeMock } from "./test-utils/vscode-mock.js";
// The real ones: what to do with a schedule is the behaviour under test,
// and a stub would assert the stub.
import {
  describePathNoLongerOffered as describePathNoLongerOfferedReal,
  planScheduleFiring as planScheduleFiringReal,
} from "@openspec-ui/core/browser";

const vscodeMock = createVscodeMock();
vi.mock("vscode", () => vscodeMock);

const readScheduledRunsMock = vi.fn();
const writeScheduledRunsMock = vi.fn();
const discoverOpenSpecWorkspaceMock = vi.fn();
const resolveHarnessConfigMock = vi.fn();
const buildRunPlanMock = vi.fn();

vi.mock("@openspec-ui/core", () => ({
  readScheduledRuns: (...args: unknown[]) => readScheduledRunsMock(...args),
  writeScheduledRuns: (...args: unknown[]) => writeScheduledRunsMock(...args),
  discoverOpenSpecWorkspace: (...args: unknown[]) => discoverOpenSpecWorkspaceMock(...args),
  resolveHarnessConfig: (...args: unknown[]) => resolveHarnessConfigMock(...args),
  buildRunPlan: (...args: unknown[]) => buildRunPlanMock(...args),
  planScheduleFiring: planScheduleFiringReal,
  describePathNoLongerOffered: describePathNoLongerOfferedReal,
}));

const { checkScheduleOnce } = await import("./scheduled-run-watcher.js");

afterEach(() => {
  vi.clearAllMocks();
});

function makeDeps() {
  return {
    getWorkspaceRoot: () => "/workspace/repo",
    revealAiPanel: vi.fn(),
    outputChannel: { appendLine: vi.fn() },
  };
}

function workspaceWith(changeName: string) {
  return {
    changes: [{ name: changeName, path: `/workspace/repo/openspec/changes/${changeName}` }],
    archivedChanges: [],
  };
}

/** Both paths the standalone dialog offers, which is what a schedule can
 * name here. */
const OFFERED = [{ id: "chain" }, { id: "single-stage" }, { id: "vscode-agent" }];

function planWithEveryPath() {
  return { resolved: "chain", because: "x", stageAgents: [], offered: OFFERED, findings: [] };
}

const past = new Date(Date.now() - 3 * 60 * 60 * 1000).toISOString();
const future = new Date(Date.now() + 3 * 60 * 60 * 1000).toISOString();

function entry(changeName: string, startAt: string, path: "chain" | "single-stage" | "vscode-agent" = "chain") {
  return { changeName, path, startAt, requestedAt: past };
}

describe("checkScheduleOnce", () => {
  // a-run-can-be-scheduled. The case this exists for is the editor being
  // closed at the appointed hour: the file outlives the process, so the
  // check runs on activation and not only on a tick.

  it("opens the dialog for a due run, saying how late it is", async () => {
    readScheduledRunsMock.mockResolvedValue([entry("demo", past)]);
    discoverOpenSpecWorkspaceMock.mockResolvedValue(workspaceWith("demo"));
    resolveHarnessConfigMock.mockResolvedValue({ stepAgents: {}, autonomyLevel: "assisted" });
    buildRunPlanMock.mockReturnValue(planWithEveryPath());
    const deps = makeDeps();

    await checkScheduleOnce(deps);

    // The dialog, not a silent start: a surface that acts and shows
    // nothing of what it read is what that dialog exists to remove, and
    // a delay does not change it.
    expect(deps.revealAiPanel).toHaveBeenCalledWith(expect.objectContaining({
      changeName: "demo",
      runNote: expect.stringContaining("hours late"),
    }));
  });

  it("opens the run on the path the entry named", async () => {
    // a-schedule-keeps-its-promise. The path chosen when the run was
    // asked for used to be stored and never read: both hosts reopened
    // the dialog on the configured resolution and the person chose
    // again.
    readScheduledRunsMock.mockResolvedValue([entry("demo", past, "single-stage")]);
    discoverOpenSpecWorkspaceMock.mockResolvedValue(workspaceWith("demo"));
    resolveHarnessConfigMock.mockResolvedValue({ stepAgents: {}, autonomyLevel: "assisted" });
    buildRunPlanMock.mockReturnValue(planWithEveryPath());
    const deps = makeDeps();

    await checkScheduleOnce(deps);

    expect(deps.revealAiPanel).toHaveBeenCalledWith(expect.objectContaining({ runPath: "single-stage" }));
  });

  it("asks for a choice when the plan no longer offers the path that was scheduled", async () => {
    readScheduledRunsMock.mockResolvedValue([entry("demo", past, "vscode-agent")]);
    discoverOpenSpecWorkspaceMock.mockResolvedValue(workspaceWith("demo"));
    resolveHarnessConfigMock.mockResolvedValue({ stepAgents: {}, autonomyLevel: "assisted" });
    buildRunPlanMock.mockReturnValue({
      resolved: "chain",
      because: "x",
      stageAgents: [],
      offered: [{ id: "chain" }, { id: "single-stage" }],
      findings: [],
    });
    const deps = makeDeps();

    await checkScheduleOnce(deps);

    const context = deps.revealAiPanel.mock.calls[0]?.[0] as { runPath?: string; runNote?: string };
    expect(context.runPath).toBeUndefined();
    expect(context.runNote).toContain("configured paths changed");
  });

  it("removes the entry once the run has been opened", async () => {
    // One that fired and stayed in the file would fire again a minute
    // later, forever.
    readScheduledRunsMock.mockResolvedValue([entry("demo", past)]);
    discoverOpenSpecWorkspaceMock.mockResolvedValue(workspaceWith("demo"));
    resolveHarnessConfigMock.mockResolvedValue({ stepAgents: {}, autonomyLevel: "assisted" });
    buildRunPlanMock.mockReturnValue(planWithEveryPath());

    await checkScheduleOnce(makeDeps());

    expect(writeScheduledRunsMock).toHaveBeenCalledWith("/workspace/repo", []);
  });

  it("leaves the entry in the file when the run cannot be opened, and says what failed", async () => {
    // a-schedule-keeps-its-promise, task 4.2. The entry used to be
    // removed first, so a malformed harness.json spent the run and
    // reported it as "reading the schedule failed" — which is not what
    // failed, and the run was gone.
    readScheduledRunsMock.mockResolvedValue([entry("demo", past)]);
    discoverOpenSpecWorkspaceMock.mockResolvedValue(workspaceWith("demo"));
    resolveHarnessConfigMock.mockRejectedValue(new Error("harness.json is not valid JSON"));
    const deps = makeDeps();

    await checkScheduleOnce(deps);

    expect(writeScheduledRunsMock).not.toHaveBeenCalled();
    expect(deps.revealAiPanel).not.toHaveBeenCalled();
    expect(deps.outputChannel.appendLine).toHaveBeenCalledWith(
      expect.stringContaining("could not be opened: harness.json is not valid JSON"),
    );
  });

  it("does nothing for a schedule whose time has not come", async () => {
    readScheduledRunsMock.mockResolvedValue([entry("demo", future)]);
    discoverOpenSpecWorkspaceMock.mockResolvedValue(workspaceWith("demo"));
    const deps = makeDeps();

    await checkScheduleOnce(deps);

    expect(deps.revealAiPanel).not.toHaveBeenCalled();
    expect(writeScheduledRunsMock).not.toHaveBeenCalled();
  });

  it("drops an entry for a change that no longer exists, and says so", async () => {
    // Neither active nor archived means deleted; the entry would wait
    // forever.
    readScheduledRunsMock.mockResolvedValue([entry("deleted-experiment", past)]);
    discoverOpenSpecWorkspaceMock.mockResolvedValue({ changes: [], archivedChanges: [] });
    const deps = makeDeps();

    await checkScheduleOnce(deps);

    expect(deps.revealAiPanel).not.toHaveBeenCalled();
    expect(writeScheduledRunsMock).toHaveBeenCalledWith("/workspace/repo", []);
    expect(deps.outputChannel.appendLine).toHaveBeenCalledWith(expect.stringContaining("no longer exists"));
  });

  it("drops a change archived after it was scheduled, and says it was archived", async () => {
    // a-schedule-keeps-its-promise, task 7.3. The prefix match used to
    // treat this as the alive case: the entry was promoted to a start,
    // the file was written without it, the change was then looked up
    // under a name no directory had, and the watcher returned with no
    // line in the output. Schedule demo for 18:00, archive it at 17:00,
    // and at 18:00 the schedule was simply gone.
    readScheduledRunsMock.mockResolvedValue([entry("demo", past)]);
    discoverOpenSpecWorkspaceMock.mockResolvedValue({
      changes: [],
      archivedChanges: [{ name: "2026-09-10-demo", path: "/workspace/repo/openspec/changes/archive/2026-09-10-demo" }],
    });
    const deps = makeDeps();

    await checkScheduleOnce(deps);

    expect(deps.revealAiPanel).not.toHaveBeenCalled();
    expect(writeScheduledRunsMock).toHaveBeenCalledWith("/workspace/repo", []);
    expect(deps.outputChannel.appendLine).toHaveBeenCalledWith(expect.stringContaining("it was archived"));
  });

  it("starts a run standing behind an archived entry on the same reading", async () => {
    const older = entry("demo", new Date(Date.now() - 5 * 60 * 60 * 1000).toISOString());
    readScheduledRunsMock.mockResolvedValue([older, entry("live", past)]);
    discoverOpenSpecWorkspaceMock.mockResolvedValue({
      changes: [{ name: "live", path: "/workspace/repo/openspec/changes/live" }],
      archivedChanges: [{ name: "2026-09-10-demo", path: "/workspace/repo/openspec/changes/archive/2026-09-10-demo" }],
    });
    resolveHarnessConfigMock.mockResolvedValue({ stepAgents: {}, autonomyLevel: "assisted" });
    buildRunPlanMock.mockReturnValue(planWithEveryPath());
    const deps = makeDeps();

    await checkScheduleOnce(deps);

    expect(deps.revealAiPanel).toHaveBeenCalledWith(expect.objectContaining({ changeName: "live" }));
  });

  it("starts one and reports the rest as waiting", async () => {
    const older = entry("demo", new Date(Date.now() - 5 * 60 * 60 * 1000).toISOString());
    readScheduledRunsMock.mockResolvedValue([entry("demo", past), older]);
    discoverOpenSpecWorkspaceMock.mockResolvedValue(workspaceWith("demo"));
    resolveHarnessConfigMock.mockResolvedValue({ stepAgents: {}, autonomyLevel: "assisted" });
    buildRunPlanMock.mockReturnValue(planWithEveryPath());
    const deps = makeDeps();

    await checkScheduleOnce(deps);

    expect(deps.revealAiPanel).toHaveBeenCalledWith(expect.objectContaining({
      runNote: expect.stringContaining("1 more scheduled run(s) are still waiting"),
    }));
  });

  it("does nothing without a workspace", async () => {
    const deps = { ...makeDeps(), getWorkspaceRoot: () => undefined };

    await checkScheduleOnce(deps);

    expect(readScheduledRunsMock).not.toHaveBeenCalled();
  });

  it("says reading failed when reading is what failed", async () => {
    readScheduledRunsMock.mockRejectedValue(new Error("scheduled-runs.json is not valid JSON"));
    const deps = makeDeps();

    await checkScheduleOnce(deps);

    expect(deps.outputChannel.appendLine).toHaveBeenCalledWith(
      expect.stringContaining("reading the schedule failed"),
    );
  });
});
