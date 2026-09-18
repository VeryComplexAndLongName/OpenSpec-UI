import { describe, expect, it } from "vitest";
import type { ChangeGraph, ChangeGraphNode } from "./change-graph.js";
import { landedBranches, landedRoots, matchesFilter } from "./view-filter.js";

function node(id: string, options: { follows?: string[]; archived?: boolean } = {}): ChangeGraphNode {
  return {
    id,
    archived: options.archived ?? false,
    metadataPath: `openspec/changes/${id}/.openspec.yaml`,
    follows: options.follows ?? [],
    supersedes: [],
    blockedBy: [],
    errors: [],
  };
}

function graphOf(nodes: ChangeGraphNode[]): ChangeGraph {
  return new Map(nodes.map((one) => [one.id, one]));
}

describe("matchesFilter", () => {
  it("matches a word in any field, whatever its case", () => {
    expect(matchesFilter("pipe", ["the-pipeline-cards-wear-metro", "Ready"])).toBe(true);
    expect(matchesFilter("READY", ["the-pipeline-cards-wear-metro", "Ready"])).toBe(true);
    expect(matchesFilter("owl", ["the-pipeline-cards-wear-metro", "Ready"])).toBe(false);
  });

  it("wants every word, and takes them from different fields", () => {
    // What a reader types when they know part of a name and part of a
    // state: both must hold, and neither has to be in the same field.
    expect(matchesFilter("pipeline blocked", ["the-pipeline-cards-wear-metro", "Blocked by apply-plan"])).toBe(true);
    expect(matchesFilter("pipeline running", ["the-pipeline-cards-wear-metro", "Blocked by apply-plan"])).toBe(false);
  });

  it("matches everything where nothing was typed", () => {
    expect(matchesFilter("", ["anything"])).toBe(true);
    expect(matchesFilter("   ", ["anything"])).toBe(true);
  });

  it("skips a field a row does not have", () => {
    expect(matchesFilter("alpha", ["alpha", undefined])).toBe(true);
    expect(matchesFilter("alpha", [undefined])).toBe(false);
  });
});

describe("landedBranches", () => {
  it("calls a branch landed where the root and everything under it are archived", () => {
    const graph = graphOf([
      node("first", { archived: true }),
      node("second", { follows: ["first"], archived: true }),
      node("third", { follows: ["second"], archived: true }),
    ]);

    const [branch] = landedBranches(graph);

    expect(branch?.root).toBe("first");
    expect(branch?.members).toEqual(["first", "second", "third"]);
    expect(branch?.landed).toBe(true);
    expect([...landedRoots(graph)]).toEqual(["first"]);
  });

  it("does not, where one change under it is still active", () => {
    const graph = graphOf([
      node("first", { archived: true }),
      node("second", { follows: ["first"], archived: true }),
      node("live", { follows: ["second"] }),
    ]);

    expect(landedBranches(graph)[0]?.landed).toBe(false);
    expect([...landedRoots(graph)]).toEqual([]);
  });

  it("treats a root with no children as its own branch", () => {
    const graph = graphOf([node("alone", { archived: true }), node("busy")]);

    expect(landedBranches(graph)).toEqual([
      { root: "alone", members: ["alone"], landed: true },
      { root: "busy", members: ["busy"], landed: false },
    ]);
  });

  it("walks a cycle once rather than for ever", () => {
    // Two changes that follow each other have no root at all, so neither
    // is a branch; what matters is that reading them terminates.
    const graph = graphOf([
      node("left", { follows: ["right"] }),
      node("right", { follows: ["left"] }),
    ]);

    expect(landedBranches(graph)).toEqual([]);
  });
});
