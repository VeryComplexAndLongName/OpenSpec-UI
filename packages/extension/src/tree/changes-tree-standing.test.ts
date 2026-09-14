import { afterEach, describe, expect, it, vi } from "vitest";
import { createVscodeMock } from "../test-utils/vscode-mock.js";

const vscodeMock = createVscodeMock();
vi.mock("vscode", () => vscodeMock);

const discoverOpenSpecWorkspaceMock = vi.fn();
vi.mock("@openspec-ui/core", () => ({
  discoverOpenSpecWorkspace: (...args: unknown[]) => discoverOpenSpecWorkspaceMock(...args),
  readTaskChecklist: vi.fn(async () => []),
  applicableRepoSetupActionIds: vi.fn(() => []),
  STANDING_FETCH_INTERVAL_MS: 300_000,
}));
vi.mock("../repo-setup-facts.js", () => ({ readRepoSetupFacts: vi.fn(async () => ({})) }));

const { ChangesTreeProvider } = await import("./changes-tree.js");
const { ChangeStandingDecorations, changeUri } = await import("./change-standing-decorations.js");

// a-change-says-where-it-stands 5.4. The words are core's; the tree writes
// them after each change's state, and a decoration colours the row to agree.

afterEach(() => {
  vi.clearAllMocks();
});

const STATES = new Map([
  ["archived-one", { key: "archived-on-main" as const, word: "Archived on main", colour: "settled" as const, badge: "A", lines: [{ text: "Ready", source: "this checkout" }] }],
  ["only-here", { key: "ready" as const, word: "Ready", colour: "none" as const, lines: [{ text: "Only here", source: "every source read" }] }],
]);

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

/** The rows once a reading has landed and the tree has drawn again. */
async function rowsAfterReading(provider: InstanceType<typeof ChangesTreeProvider>) {
  const drawn = new Promise<void>((resolve) => provider.onDidChangeTreeData(() => resolve()));
  await provider.getChildren();
  await drawn;
  const items = await provider.getChildren();
  return new Map(items.filter((item) => item.contextValue === "openspec-ui.activeChange").map((item) => [String(item.label), item]));
}

describe("ChangesTreeProvider — where each change stands", () => {
  it("writes the word after the state of a change archived on main and of one only here, with decorations that agree", async () => {
    workspace();
    const decorations = new ChangeStandingDecorations();
    const provider = new ChangesTreeProvider("/repo", { readStates: async () => STATES, decorations });

    const rows = await rowsAfterReading(provider);

    expect(rows.get("archived-one")?.description).toBe("in-progress — Archived on main");
    expect(rows.get("only-here")?.description).toBe("draft — Ready");
    expect((rows.get("only-here") as { tooltip?: string }).tooltip).toContain("Only here (every source read)");
    expect(decorations.provideFileDecoration(changeUri("archived-one") as never)).toEqual({
      tooltip: "Archived on main",
      badge: "A",
      color: new vscodeMock.ThemeColor("charts.green"),
    });
    // A change that is simply ready gets its word as a tooltip, and no colour.
    expect(decorations.provideFileDecoration(changeUri("only-here") as never)).toEqual({ tooltip: "Ready" });
  });

  it("reads again with a fetch now on Refresh, and only past the interval otherwise", async () => {
    workspace();
    const readStates = vi.fn(async () => STATES);
    const provider = new ChangesTreeProvider("/repo", { readStates });
    await rowsAfterReading(provider);

    provider.refresh({ fetchNow: true });
    await rowsAfterReading(provider);

    expect(readStates.mock.calls.map((call) => (call as unknown as [string, string])[1])).toEqual(["interval", "now"]);
  });
});
