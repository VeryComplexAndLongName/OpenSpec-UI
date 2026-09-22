import { readFileSync } from "node:fs";
import { describe, expect, it, vi } from "vitest";
import type { ChangeGraph, ChangeGraphNode } from "@openspec-ui/core";

// Reads the extension's manifest from disk, so its cost varies with the
// machine. Measured 2026-09-22 at 44ms test time for this file on this
// machine, idle. Sized for a loaded runner, not for that.
vi.setConfig({ testTimeout: 10_000 });

const { changesStatingRelations, statingRelation, withoutRelationMark } = await import("./relations-context.js");

function graphOf(nodes: Record<string, Partial<ChangeGraphNode>>): ChangeGraph {
  return new Map(Object.entries(nodes).map(([id, value]) => [id, {
    id,
    archived: value.archived ?? false,
    follows: value.follows ?? [],
    supersedes: value.supersedes ?? [],
    blockedBy: value.blockedBy ?? [],
    errors: [],
    metadataPath: `openspec/changes/${id}/.openspec.yaml`,
  }]));
}

interface MenuEntry { command: string; when?: string; group?: string }

function contextMenu(): MenuEntry[] {
  const manifest = JSON.parse(readFileSync(new URL("../package.json", import.meta.url), "utf8")) as {
    contributes: { menus: Record<string, MenuEntry[]> };
  };
  return manifest.contributes.menus["view/item/context"] ?? [];
}

/** The context values a clause names, split on its `||`. Every clause
 * this file reads is a plain disjunction. */
function namedRows(when: string | undefined): string[] {
  return (when ?? "").split("||").map((part) => part.replace(/^\s*viewItem == /u, "").trim());
}

describe("which rows may take a relation back (relations-and-leftovers-explain-themselves)", () => {
  it("names the active changes stating any relation, and no other", () => {
    const graph = graphOf({
      zeta: { blockedBy: ["alpha"] },
      alpha: {},
      beta: { follows: ["alpha"] },
      gamma: { supersedes: ["old"] },
      old: { archived: true, follows: ["alpha"] },
    });

    expect(changesStatingRelations(graph)).toEqual(["beta", "gamma", "zeta"]);
  });

  it("marks only the rows a relation edit is offered on, and unmarks them", () => {
    expect(statingRelation("openspec-ui.activeChange")).toBe("openspec-ui.activeChange.related");
    expect(statingRelation("openspec-ui.unwrittenChange")).toBe("openspec-ui.unwrittenChange.related");
    expect(statingRelation("openspec-ui.activeChange.elsewhere")).toBe("openspec-ui.activeChange.elsewhere");
    expect(statingRelation("openspec-ui.archivedChange")).toBe("openspec-ui.archivedChange");
    expect(withoutRelationMark("openspec-ui.graphActiveChange.related")).toBe("openspec-ui.graphActiveChange");
    expect(withoutRelationMark("openspec-ui.activeChange.elsewhere")).toBe("openspec-ui.activeChange.elsewhere");
  });

  it("offers Remove Relation only on a row that states one", () => {
    const remove = contextMenu().filter((entry) => entry.command === "openspec-ui.removeRelation");

    expect(remove).toHaveLength(1);
    expect(namedRows(remove[0]?.when).sort()).toEqual([
      "openspec-ui.activeChange.related",
      "openspec-ui.graphActiveChange.related",
      "openspec-ui.unwrittenChange.related",
    ]);
  });

  it("offers Add Relation on a change not written yet, and never on an archived change's leavings", () => {
    const add = contextMenu().find((entry) => entry.command === "openspec-ui.addRelation");

    expect(namedRows(add?.when)).toContain("openspec-ui.unwrittenChange");
    expect(namedRows(add?.when)).toContain("openspec-ui.unwrittenChange.related");
    expect(namedRows(add?.when)).not.toContain("openspec-ui.leftover");
  });

  it("offers every entry a plain row has on the same row stating a relation", () => {
    for (const entry of contextMenu()) {
      const rows = namedRows(entry.when);
      for (const kind of ["openspec-ui.activeChange", "openspec-ui.graphActiveChange", "openspec-ui.unwrittenChange"]) {
        if (rows.includes(kind)) expect(rows, `${entry.command} names ${kind}`).toContain(`${kind}.related`);
      }
    }
  });
});
