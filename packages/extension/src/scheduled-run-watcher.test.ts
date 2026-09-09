import { afterEach, describe, expect, it, vi } from "vitest";
import { createVscodeMock } from "./test-utils/vscode-mock.js";
// The real one: whether an entry is due is the behaviour under test, and
// a stub would assert the stub.
import { readSchedule as readScheduleReal, withoutEntry as withoutEntryReal } from "@openspec-ui/core/browser";

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
  readSchedule: readScheduleReal,
  withoutEntry: withoutEntryReal,
  describeLateness: (late: { lateByMs: number }) => `late by ${late.lateByMs}ms`,
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

const past = new Date(Date.now() - 3 * 60 * 60 * 1000).toISOString();
const future = new Date(Date.now() + 3 * 60 * 60 * 1000).toISOString();

function entry(changeName: string, startAt: string) {
  return { changeName, path: "chain" as const, startAt, requestedAt: past };
}

describe("checkScheduleOnce", () => {
  // a-run-can-be-scheduled. The case this exists for is the editor being
  // closed at the appointed hour: the file outlives the process, so the
  // check runs on activation and not only on a tick.

  it("opens the dialog for a due run, saying how late it is", async () => {
    readScheduledRunsMock.mockResolvedValue([entry("demo", past)]);
    discoverOpenSpecWorkspaceMock.mockResolvedValue(workspaceWith("demo"));
    resolveHarnessConfigMock.mockResolvedValue({ stepAgents: {}, autonomyLevel: "assisted" });
    buildRunPlanMock.mockReturnValue({ resolved: "chain", because: "x", stageAgents: [], offered: [], findings: [] });
    const deps = makeDeps();

    await checkScheduleOnce(deps);

    // The dialog, not a silent start: a surface that acts and shows
    // nothing of what it read is what that dialog exists to remove, and
    // a delay does not change it.
    expect(deps.revealAiPanel).toHaveBeenCalledWith(expect.objectContaining({
      changeName: "demo",
      runNote: expect.stringContaining("late by"),
    }));
  });

  it("removes the entry before opening anything", async () => {
    // One that fired and stayed in the file would fire again a minute
    // later, forever.
    readScheduledRunsMock.mockResolvedValue([entry("demo", past)]);
    discoverOpenSpecWorkspaceMock.mockResolvedValue(workspaceWith("demo"));
    resolveHarnessConfigMock.mockResolvedValue({ stepAgents: {}, autonomyLevel: "assisted" });
    buildRunPlanMock.mockReturnValue({ resolved: "chain", because: "x", stageAgents: [], offered: [], findings: [] });

    await checkScheduleOnce(makeDeps());

    expect(writeScheduledRunsMock).toHaveBeenCalledWith("/workspace/repo", []);
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

  it("starts one and reports the rest as waiting", async () => {
    const older = entry("demo", new Date(Date.now() - 5 * 60 * 60 * 1000).toISOString());
    readScheduledRunsMock.mockResolvedValue([entry("demo", past), older]);
    discoverOpenSpecWorkspaceMock.mockResolvedValue(workspaceWith("demo"));
    resolveHarnessConfigMock.mockResolvedValue({ stepAgents: {}, autonomyLevel: "assisted" });
    buildRunPlanMock.mockReturnValue({ resolved: "chain", because: "x", stageAgents: [], offered: [], findings: [] });
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
});
