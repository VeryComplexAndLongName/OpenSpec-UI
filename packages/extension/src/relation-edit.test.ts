import { afterEach, describe, expect, it, vi } from "vitest";
import { createVscodeMock } from "./test-utils/vscode-mock.js";
import type { ChangeGraph, ChangeGraphNode } from "@openspec-ui/core";

const vscodeMock = createVscodeMock();
vi.mock("vscode", () => vscodeMock);

const { pickChangeToRelate, pickRelationKind, pickRelationToRemove } = await import("./relation-edit.js");

afterEach(() => {
  vi.clearAllMocks();
});

function node(id: string, value: Partial<ChangeGraphNode> = {}): ChangeGraphNode {
  return {
    id,
    archived: value.archived ?? false,
    follows: value.follows ?? [],
    supersedes: value.supersedes ?? [],
    blockedBy: value.blockedBy ?? [],
    errors: [],
    metadataPath: `openspec/changes/${id}/.openspec.yaml`,
  };
}

function graphOf(nodes: ChangeGraphNode[]): ChangeGraph {
  return new Map(nodes.map((one) => [one.id, one]));
}

function itemsOfLastPick(): Array<Record<string, unknown>> {
  return vscodeMock.window.showQuickPick.mock.calls.at(-1)?.[0] as Array<Record<string, unknown>>;
}

describe("pickRelationKind", () => {
  it("offers the three relations, each with what it means", async () => {
    vscodeMock.window.showQuickPick.mockResolvedValue({ key: "blocked_by" });

    const picked = await pickRelationKind("a-change");

    expect(picked).toBe("blocked_by");
    expect(itemsOfLastPick().map((item) => item.key)).toEqual(["follows", "supersedes", "blocked_by"]);
    // A reader who knows one relation and not the others should not have
    // to guess which is the schedule and which is the history.
    expect(String(itemsOfLastPick()[2]?.detail)).toContain("archived");
  });

  it("answers with nothing where the reader escapes", async () => {
    vscodeMock.window.showQuickPick.mockResolvedValue(undefined);

    expect(await pickRelationKind("a-change")).toBeUndefined();
  });
});

describe("pickChangeToRelate", () => {
  const graph = graphOf([
    node("the-change-being-edited", { blockedBy: ["already-stated"] }),
    node("already-stated"),
    node("another-active"),
    node("an-old-one", { archived: true }),
  ]);

  it("never offers the change itself, since core would refuse it", async () => {
    vscodeMock.window.showQuickPick.mockResolvedValue(undefined);

    await pickChangeToRelate(graph, "the-change-being-edited", "blocked_by");

    expect(itemsOfLastPick().map((item) => item.id)).not.toContain("the-change-being-edited");
  });

  it("puts the active changes first and says which are archived", async () => {
    vscodeMock.window.showQuickPick.mockResolvedValue({ id: "another-active" });

    const picked = await pickChangeToRelate(graph, "the-change-being-edited", "follows");

    expect(picked).toBe("another-active");
    expect(itemsOfLastPick().map((item) => item.id)).toEqual(["already-stated", "another-active", "an-old-one"]);
    expect(String(itemsOfLastPick()[2]?.description)).toContain("archived");
  });

  it("marks a relation that is already stated rather than hiding it", async () => {
    vscodeMock.window.showQuickPick.mockResolvedValue(undefined);

    await pickChangeToRelate(graph, "the-change-being-edited", "blocked_by");

    const stated = itemsOfLastPick().find((item) => item.id === "already-stated");
    expect(String(stated?.description)).toContain("already stated");
  });
});

describe("pickRelationToRemove", () => {
  it("lists only what the change actually states, with the relation beside it", async () => {
    vscodeMock.window.showQuickPick.mockResolvedValue({ relation: { key: "follows", id: "a-parent" } });

    const picked = await pickRelationToRemove(node("a-change", { follows: ["a-parent"], blockedBy: ["a-blocker"] }));

    expect(picked).toEqual({ key: "follows", id: "a-parent" });
    expect(itemsOfLastPick().map((item) => item.label)).toEqual(["a-parent", "a-blocker"]);
    expect(itemsOfLastPick().map((item) => item.description)).toEqual(["Follows", "Blocked by"]);
  });

  it("says the change states no relation rather than opening an empty pick", async () => {
    const picked = await pickRelationToRemove(node("states-nothing"));

    expect(picked).toBeUndefined();
    expect(vscodeMock.window.showQuickPick).not.toHaveBeenCalled();
    expect(vscodeMock.window.showInformationMessage).toHaveBeenCalledWith(
      expect.stringContaining("states no relation"),
    );
  });
});
