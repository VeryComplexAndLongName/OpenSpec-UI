import { afterEach, describe, expect, it, vi } from "vitest";
import type { ChangeStanding, SurveyedDirectory, SurveyedRun, WorktreeSurvey } from "@openspec-ui/core";
import { createVscodeMock } from "../test-utils/vscode-mock.js";

const vscodeMock = createVscodeMock();
vi.mock("vscode", () => vscodeMock);

const discoverOpenSpecWorkspaceMock = vi.fn();
vi.mock("@openspec-ui/core", async () => {
  // The words are core's own: the browser-safe half describes them, and
  // nothing here reads a repository.
  const browser = await vi.importActual<typeof import("@openspec-ui/core/browser")>("@openspec-ui/core/browser");
  return {
    describeChangeState: browser.describeChangeState,
    withSurveyedRuns: browser.withSurveyedRuns,
  // Whose a change is: core's own reading, which touches no repository
  // (changes-shows-one-change-and-who-owns-it).
  changeOwnerships: browser.changeOwnerships,
  changesOnlyElsewhere: browser.changesOnlyElsewhere,
  describeChangesOnlyElsewhere: browser.describeChangesOnlyElsewhere,
  describeOwnership: browser.describeOwnership,
  isOursToWrite: browser.isOursToWrite,
    discoverOpenSpecWorkspace: (...args: unknown[]) => discoverOpenSpecWorkspaceMock(...args),
    readTaskChecklist: vi.fn(async () => []),
    applicableRepoSetupActionIds: vi.fn(() => []),
    STANDING_FETCH_INTERVAL_MS: 300_000,
  };
});
vi.mock("../repo-setup-facts.js", () => ({ readRepoSetupFacts: vi.fn(async () => ({})) }));

const { ChangesTreeProvider } = await import("./changes-tree.js");
const { ChangeStandingDecorations, changeUri } = await import("./change-standing-decorations.js");

// a-change-says-where-it-stands 5.4. The words are core's; the tree writes
// them after each change's state, and a decoration colours the row to agree.

afterEach(() => {
  vi.clearAllMocks();
});

const SOURCES = { fetch: { attempted: false as const }, pullRequests: { read: true as const } };

const ARCHIVED: ChangeStanding = {
  changeName: "archived-one",
  here: { label: "repo", path: "/repo", counts: { done: 1, total: 3 }, runs: [] },
  elsewhere: [],
  main: { kind: "archived", archiveName: "2026-09-14-archived-one" },
};
const ONLY_HERE: ChangeStanding = {
  changeName: "only-here",
  here: { label: "repo", path: "/repo", counts: { done: 0, total: 2 }, runs: [] },
  elsewhere: [],
};

function directory(runs: SurveyedRun[] = []): SurveyedDirectory {
  return { path: "/repo", label: "repo", labelDeclared: false, isMain: true, isThis: true, runs, readable: true, changes: [], authorDiffers: false };
}

function run(changeName: string, partial: Partial<SurveyedRun> = {}): SurveyedRun {
  return {
    instanceId: "i1",
    changeName,
    stage: "apply",
    activity: "running apply",
    activitySinceMs: 0,
    heartbeatAgeMs: 0,
    activityAt: "2026-09-17T12:00:00.000Z",
    heartbeatAt: "2026-09-17T12:00:00.000Z",
    gone: false,
    workingDirectory: "/repo",
    runId: "r1",
    waiting: null,
    signature: "unverified",
    ...partial,
  };
}

function survey(runs: SurveyedRun[] = []): WorktreeSurvey {
  return { directories: [directory(runs)], runsElsewhere: [] };
}

function reading(runs: SurveyedRun[] = []) {
  return { standings: { readAt: "2026-09-17T12:00:00.000Z", standings: [ARCHIVED, ONLY_HERE], sources: SOURCES }, survey: survey(runs) };
}

function workspace() {
  discoverOpenSpecWorkspaceMock.mockResolvedValue({
    configPath: "/repo/openspec/config.yaml",
    configExists: true,
    initialized: true,
    changes: [
      { name: "archived-one", path: "/repo/openspec/changes/archived-one", state: "in-progress", artifacts: [] },
      { name: "only-here", path: "/repo/openspec/changes/only-here", state: "draft", artifacts: [] },
    ],
  });
}

async function rows(provider: InstanceType<typeof ChangesTreeProvider>) {
  const items = await provider.getChildren();
  return new Map(items.filter((item) => item.contextValue === "openspec-ui.activeChange").map((item) => [String(item.label), item]));
}

/** The rows once a reading has landed and the tree has drawn again. */
async function rowsAfterReading(provider: InstanceType<typeof ChangesTreeProvider>) {
  const drawn = new Promise<void>((resolve) => provider.onDidChangeTreeData(() => resolve()));
  await provider.getChildren();
  await drawn;
  return rows(provider);
}

// a-blocked-change-says-so-where-it-is-listed 3.2, reported by DW: the tree
// read Ready for a change the Change Graph called blocked, because the row's
// word was asked for without the readiness fact.
describe("ChangesTreeProvider - the declared order", () => {
  it("writes Blocked with the blocker's name on the row it blocks", async () => {
    workspace();
    const provider = new ChangesTreeProvider("/repo", {
      readStandings: async () => ({
        ...reading(),
        readiness: {
          changes: [{
            changeName: "only-here",
            run: { state: "blocked", blockedBy: ["archived-one"] },
            blockers: ["archived-one"],
            capabilities: [],
          }],
        },
      }) as never,
    });

    const drawn = await rowsAfterReading(provider);

    // The separator is the one the tree already writes between the state
    // and the word; what this pins is the word.
    expect(drawn.get("only-here")?.description).toContain("Blocked by archived-one");
    expect(String(drawn.get("only-here")?.description).startsWith("draft")).toBe(true);
  });
});

describe("ChangesTreeProvider — where each change stands", () => {
  it("writes the word after the state of a change archived on main and of one only here, with decorations that agree", async () => {
    workspace();
    const decorations = new ChangeStandingDecorations();
    const provider = new ChangesTreeProvider("/repo", { readStandings: async () => reading(), decorations });

    const drawn = await rowsAfterReading(provider);

    expect(drawn.get("archived-one")?.description).toBe("in-progress — Archived on main");
    expect(drawn.get("only-here")?.description).toBe("draft — Ready");
    expect((drawn.get("only-here") as { tooltip?: string }).tooltip).toContain("Only here (every source read)");
    // The decoration carries the badge and the word, and no colour: the
    // colour is on the icon, and a decoration's colour would tint the label
    // and the badge (the-icon-carries-the-colour).
    expect(decorations.provideFileDecoration(changeUri("archived-one") as never)).toEqual({
      tooltip: "Archived on main",
      badge: "A",
    });
    // A change that is simply ready gets its word as a tooltip.
    expect(decorations.provideFileDecoration(changeUri("only-here") as never)).toEqual({ tooltip: "Ready" });
  });

  // the-icon-carries-the-colour
  it("draws the standing's colour on the item's icon, and leaves an item without one alone", async () => {
    workspace();
    const provider = new ChangesTreeProvider("/repo", { readStandings: async () => reading() });

    const drawn = await rowsAfterReading(provider);

    const settled = (drawn.get("archived-one") as { iconPath?: { id?: string; color?: { id?: string } } }).iconPath;
    expect(settled?.color?.id).toBe("charts.green");
    // The icon itself is still the one the state chooses: the colour is
    // laid over it, not instead of it.
    expect(typeof settled?.id).toBe("string");

    const plain = (drawn.get("only-here") as { iconPath?: { id?: string; color?: { id?: string } } }).iconPath;
    expect(plain?.color).toBeUndefined();
  });

  it("reads again with a fetch now on Refresh, and only past the interval otherwise", async () => {
    workspace();
    const readStandings = vi.fn(async () => reading());
    const provider = new ChangesTreeProvider("/repo", { readStandings });
    await rowsAfterReading(provider);

    provider.refresh({ fetchNow: true });
    await rowsAfterReading(provider);

    expect(readStandings.mock.calls.map((call) => (call as unknown as [string, string])[1])).toEqual(["interval", "now"]);
  });
});

// the-changes-views-see-a-run-start 2.5: a status record's event reads the
// runs again over the survey the standings reading took, and nothing else.
describe("ChangesTreeProvider — the runs read again", () => {
  /** A provider that has drawn its first reading, and the runs its next
   * re-read will find. */
  async function drawnProvider() {
    workspace();
    let next = survey();
    const readStandings = vi.fn(async () => reading());
    const readRuns = vi.fn(async (_held: WorktreeSurvey) => next);
    const decorations = { update: vi.fn() };
    const provider = new ChangesTreeProvider("/repo", { readStandings, readRuns, decorations });
    await rowsAfterReading(provider);
    return { provider, readStandings, readRuns, decorations, setRuns: (runs: SurveyedRun[]) => { next = survey(runs); } };
  }

  /** Waits for the re-read to settle, and says whether the tree was told to
   * draw again. */
  async function refreshRuns(provider: InstanceType<typeof ChangesTreeProvider>, readRuns: ReturnType<typeof vi.fn>) {
    const fired = vi.fn();
    const subscription = provider.onDidChangeTreeData(fired);
    const calls = readRuns.mock.calls.length;
    provider.refreshRuns();
    await vi.waitFor(() => expect(readRuns.mock.calls.length).toBe(calls + 1));
    await new Promise((resolve) => setTimeout(resolve, 0));
    subscription.dispose();
    return fired.mock.calls.length > 0;
  }

  it("turns Ready into Running when a record appears, without reading standings again", async () => {
    const { provider, readStandings, readRuns, decorations, setRuns } = await drawnProvider();
    setRuns([run("only-here")]);

    expect(await refreshRuns(provider, readRuns)).toBe(true);

    expect((await rows(provider)).get("only-here")?.description).toBe("draft — Running");
    expect(readStandings).toHaveBeenCalledTimes(1);
    // Read over the survey the standings reading took.
    expect(readRuns.mock.calls[0]?.[0]).toEqual(survey());
    expect(decorations.update).toHaveBeenCalledTimes(2);
  });

  it("draws nothing when the runs are the same, as on a heartbeat", async () => {
    const { provider, readRuns, decorations, setRuns } = await drawnProvider();
    setRuns([run("only-here")]);
    await refreshRuns(provider, readRuns);

    expect(await refreshRuns(provider, readRuns)).toBe(false);
    expect(decorations.update).toHaveBeenCalledTimes(2);
  });

  it("turns Running back into the standing's own word when the record goes", async () => {
    const { provider, readRuns, setRuns } = await drawnProvider();
    setRuns([run("only-here")]);
    await refreshRuns(provider, readRuns);

    setRuns([]);
    expect(await refreshRuns(provider, readRuns)).toBe(true);
    expect((await rows(provider)).get("only-here")?.description).toBe("draft — Ready");
  });

  it("reads standings when none has been read yet", async () => {
    workspace();
    const readStandings = vi.fn(async () => reading());
    const readRuns = vi.fn(async () => survey());
    const provider = new ChangesTreeProvider("/repo", { readStandings, readRuns });

    const drawn = new Promise<void>((resolve) => provider.onDidChangeTreeData(() => resolve()));
    provider.refreshRuns();
    await drawn;
    await rowsAfterReading(provider);

    expect(readStandings).toHaveBeenCalledTimes(1);
    expect(readRuns).not.toHaveBeenCalled();
  });
});
