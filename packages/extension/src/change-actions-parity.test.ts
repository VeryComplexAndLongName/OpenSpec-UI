import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { CHANGE_ACTIONS } from "@openspec-ui/core";
import { describe, expect, it, vi } from "vitest";

// a-change-is-acted-on-from-its-card (ADR 0044): the Changes tree offers a
// change the same actions its card does, from core's one list; neither has
// one the other lacks. Asserted over the manifest, as one-way-in.test.ts is.
// One synchronous read; sized above it as that file explains.
vi.setConfig({ testTimeout: 10000 });

interface MenuEntry { command?: string; submenu?: string; when?: string; group?: string }

const manifest = JSON.parse(
  readFileSync(path.join(path.dirname(fileURLToPath(import.meta.url)), "..", "package.json"), "utf8"),
) as {
  contributes: {
    commands: Array<{ command: string; title: string; icon?: string }>;
    menus: Record<string, MenuEntry[]>;
    submenus?: Array<{ id: string; label: string }>;
  };
};

/** Whether a `when` the manifest writes as `viewItem == x || ...` holds for a
 * row of this context value. A clause of any other form fails the test, so a
 * new form is noticed rather than read as true. */
function holds(when: string | undefined, contextValue: string): boolean {
  if (when === undefined) return true;
  return when.split("||").some((clause) => {
    const match = /^\s*viewItem == ([\w.-]+)\s*$/u.exec(clause);
    if (match === null) throw new Error(`a when this test cannot read: ${when}`);
    return match[1] === contextValue;
  });
}

/** Every command a row's right-click menu offers, through its submenus too. */
function offeredOn(contextValue: string): Set<string> {
  const offered = new Set<string>();
  const menus = manifest.contributes.menus;
  for (const entry of menus["view/item/context"] ?? []) {
    if (entry.group === "inline" || !holds(entry.when, contextValue)) continue;
    if (entry.command !== undefined) offered.add(entry.command);
    for (const inner of entry.submenu !== undefined ? menus[entry.submenu] ?? [] : []) {
      if (inner.command !== undefined && holds(inner.when, contextValue)) offered.add(inner.command);
    }
  }
  return offered;
}

describe("a change's actions, on its row and on its card", () => {
  const actions = CHANGE_ACTIONS.map((action) => action.command);

  it("offers a row worked in another working directory every action a row of this checkout has, and both every action of core's list", () => {
    const here = offeredOn("openspec-ui.activeChange");
    const related = offeredOn("openspec-ui.activeChange.related");
    const there = offeredOn("openspec-ui.activeChange.elsewhere");

    // A row here offers to open a worktree only where the change has one,
    // and to remove a relation only where it states one: a context menu has
    // no disabled state (relations-and-leftovers-explain-themselves). A row
    // worked elsewhere has its relations read there, so it offers both.
    expect(actions.filter((command) => !here.has(command))).toEqual(["openspec-ui.openWorktree", "openspec-ui.openChangeCopy", "openspec-ui.removeRelation"]);
    expect(actions.filter((command) => !related.has(command))).toEqual(["openspec-ui.openWorktree", "openspec-ui.openChangeCopy"]);
    expect(actions.filter((command) => !there.has(command))).toEqual([]);
    // Nothing on a row that the card does not have, but the way to all of them.
    expect([...there].filter((command) => !actions.includes(command))).toEqual(["openspec-ui.showActions"]);
  });

  it("titles and draws each action as core's list does", () => {
    const byId = new Map(manifest.contributes.commands.map((entry) => [entry.command, entry]));
    const differ = CHANGE_ACTIONS.filter((action) => byId.get(action.command)?.title !== action.title || byId.get(action.command)?.icon !== `$(${action.icon})`);

    expect(differ.map((action) => action.command)).toEqual([]);
  });

  it("groups a row's menu by the actions' groups: what runs first, Inspect and Set Up as submenus, the Danger ones last", () => {
    const menus = manifest.contributes.menus;
    const context = menus["view/item/context"] ?? [];
    const groupOf = (command: string) => context.find((entry) => entry.command === command && holds(entry.when, "openspec-ui.activeChange") && entry.group !== "inline")?.group;
    for (const action of CHANGE_ACTIONS) {
      if (action.group === "run") expect(groupOf(action.command), action.id).toMatch(/^1_run@/u);
      if (action.group === "danger") expect(groupOf(action.command), action.id).toMatch(/^9_danger@/u);
      if (action.group === "inspect") expect((menus["openspec-ui.changeInspect"] ?? []).map((entry) => entry.command), action.id).toContain(action.command);
      if (action.group === "set-up") expect((menus["openspec-ui.changeSetUp"] ?? []).map((entry) => entry.command), action.id).toContain(action.command);
    }
    expect(manifest.contributes.submenus?.map((submenu) => submenu.label)).toEqual(["Inspect", "Set Up"]);
  });
});
