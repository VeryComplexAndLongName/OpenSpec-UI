import { afterEach, describe, expect, it, vi } from "vitest";
import type { ChangeStanding, SurveyedDirectory, SurveyedRun, WorktreeSurvey } from "@openspec-ui/core";
import { createVscodeMock } from "../test-utils/vscode-mock.js";

const vscodeMock = createVscodeMock();
vi.mock("vscode", () => vscodeMock);

const discoverOpenSpecWorkspaceMock = vi.fn();
vi.mock("@openspec-ui/core", async () => {
  const browser = await vi.importActual<typeof import("@openspec-ui/core/browser")>("@openspec-ui/core/browser");
  return {
    ...browser,
    discoverOpenSpecWorkspace: (...args: unknown[]) => discoverOpenSpecWorkspaceMock(...args),
    readTaskChecklist: vi.fn(async () => []),
    applicableRepoSetupActionIds: vi.fn(() => []),
    STANDING_FETCH_INTERVAL_MS: 300_000,
  };
});
vi.mock("../repo-setup-facts.js", () => ({ readRepoSetupFacts: vi.fn(async () => ({})) }));

const { ChangesTreeProvider } = await import("./changes-tree.js");

// changes-shows-one-change-and-who-owns-it 2.1-2.4. A working directory is
// cut from the default branch, so it holds every change that was active
// there. These assert the tree says which of them is its own business.

afterEach(() => {
  vi.clearAllMocks();
});

const SOURCES = { fetch: { attempted: false as const }, pullRequests: { read: true as const } };

function standing(changeName: string): ChangeStanding {
  return {
    changeName,
    here: { label: "mine", path: "/wt/mine", counts: { done: 0, total: 2 }, runs: [] },
    elsewhere: [],
  };
}

function run(partial: Partial<SurveyedRun> = {}): SurveyedRun {
  return {
    instanceId: "i1",
    changeName: "theirs",
    stage: null,
    activity: "working",
    activitySinceMs: 0,
    heartbeatAgeMs: 0,
    activityAt: "2026-09-20T12:00:00.000Z",
    heartbeatAt: "2026-09-20T12:00:00.000Z",
    gone: false,
    workingDirectory: "/wt/theirs",
    runId: null,
    waiting: null,
    signature: "unverified",
    ...partial,
  };
}

function directory(partial: Partial<Extract<SurveyedDirectory, { readable: true }>>): SurveyedDirectory {
  return {
    path: "/wt/mine",
    label: "mine",
    labelDeclared: false,
    isMain: false,
    isThis: false,
    runs: [],
    readable: true,
    changes: [],
    authorDiffers: false,
    ...partial,
  };
}

/** This directory works `mine`; another works `theirs`; `nobodys` is in
 * the checkout and taken up by no directory. */
function survey(runs: SurveyedRun[] = []): WorktreeSurvey {
  return {
    directories: [
      directory({ path: "/repo", label: "repo", isMain: true }),
      directory({ isThis: true, branch: "mine", belongsTo: "mine" }),
      directory({ path: "/wt/theirs", label: "theirs", branch: "theirs", belongsTo: "theirs", runs }),
    ],
    runsElsewhere: [],
  };
}

function workspace(names = ["theirs", "nobodys", "mine"]): void {
  discoverOpenSpecWorkspaceMock.mockResolvedValue({
    configPath: "/wt/mine/openspec/config.yaml",
    configExists: true,
    initialized: true,
    changes: names.map((name) => ({ name, path: `/wt/mine/openspec/changes/${name}`, state: "draft", artifacts: [] })),
  });
}

function providerOver(runs: SurveyedRun[] = [], names?: string[]) {
  workspace(names);
  const listed = names ?? ["theirs", "nobodys", "mine"];
  return new ChangesTreeProvider("/wt/mine", {
    readStandings: async () => ({
      standings: { readAt: "2026-09-20T12:00:00.000Z", standings: listed.map(standing), sources: SOURCES },
      survey: survey(runs),
    }),
  });
}

/** The change rows once a reading has landed and the tree has drawn
 * again. */
async function changeRows(provider: InstanceType<typeof ChangesTreeProvider>) {
  const drawn = new Promise<void>((resolve) => provider.onDidChangeTreeData(() => resolve()));
  await provider.getChildren();
  await drawn;
  const items = await provider.getChildren();
  return items.filter((item) => String(item.contextValue).startsWith("openspec-ui.activeChange"));
}

describe("ChangesTreeProvider - whose each change is", () => {
  it("draws this working directory's own change first, and names it in the view's description", async () => {
    const provider = providerOver();

    const rows = await changeRows(provider);

    expect(rows.map((row) => String(row.label))).toEqual(["mine", "nobodys", "theirs"]);
    expect(provider.ownChangeName()).toBe("mine");
  });

  it("says which directory another change is worked in, and locks the row", async () => {
    const provider = providerOver([run({ signature: "verified", person: { keyId: "k1", label: "DW" } })]);

    const rows = await changeRows(provider);
    const theirs = rows.find((row) => String(row.label) === "theirs");

    expect(String(theirs?.description)).toContain("worked in theirs, by DW");
    expect(theirs?.contextValue).toBe("openspec-ui.activeChange.elsewhere");
    expect((theirs?.iconPath as { id: string }).id).toBe("lock");
    expect(String(theirs?.tooltip)).toContain("worked in theirs, by DW");
  });

  it("names no person where the record does not check out", async () => {
    const provider = providerOver([run({ signature: "does-not-check-out" })]);

    const rows = await changeRows(provider);
    const theirs = rows.find((row) => String(row.label) === "theirs");

    expect(String(theirs?.description)).toContain("by a record that does not check out");
    expect(theirs?.contextValue).toBe("openspec-ui.activeChange.elsewhere");
  });

  it("leaves a change nobody has taken up as it was, so it can be picked up", async () => {
    const provider = providerOver();

    const rows = await changeRows(provider);
    const free = rows.find((row) => String(row.label) === "nobodys");

    expect(free?.contextValue).toBe("openspec-ui.activeChange");
    expect(String(free?.description)).not.toContain("worked in");
    expect((free?.iconPath as { id: string }).id).not.toBe("lock");
  });

  it("says how many changes are worked in directories this checkout does not have", async () => {
    // Cut before `theirs` was proposed: no row above can carry it.
    const provider = providerOver([], ["mine", "nobodys"]);

    const items = await (async () => {
      const drawn = new Promise<void>((resolve) => provider.onDidChangeTreeData(() => resolve()));
      await provider.getChildren();
      await drawn;
      return provider.getChildren();
    })();
    const pointer = items.find((item) => String(item.label).includes("other working directories"));

    expect(String(pointer?.label)).toBe("1 change is worked in other working directories, and not in this one");
    expect(String(pointer?.description)).toContain("theirs (theirs)");
    expect(pointer?.command?.command).toBe("openspec-ui.openPipeline");
  });
});
