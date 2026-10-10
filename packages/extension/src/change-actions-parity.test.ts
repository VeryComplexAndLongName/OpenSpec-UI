import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { CHANGE_ACTIONS } from "@openspec-ui/core";
import { describe, expect, it, vi } from "vitest";

// a-change-is-acted-on-from-its-card (ADR 0044): a change's actions come
// from core's one list. Since the-side-panel-is-the-workspace, the card is
// where they are offered, and a Changes row offers the way to all of them -
// Show Actions... - and nothing else. Asserted over the manifest, as
// one-way-in.test.ts is.
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

  it("offers on a change's row Show Actions... alone, wherever the change is worked", () => {
    for (const contextValue of ["openspec-ui.activeChange", "openspec-ui.activeChange.related", "openspec-ui.activeChange.elsewhere"]) {
      expect([...offeredOn(contextValue)], contextValue).toEqual(["openspec-ui.showActions"]);
    }
  });

  it("titles and draws each action as core's list does", () => {
    const byId = new Map(manifest.contributes.commands.map((entry) => [entry.command, entry]));
    const differ = CHANGE_ACTIONS.filter((action) => byId.get(action.command)?.title !== action.title || byId.get(action.command)?.icon !== `$(${action.icon})`);

    expect(differ.map((action) => action.command)).toEqual([]);
  });

  it("keeps no submenu of the row's former menu, and no action drawn on the row itself", () => {
    const menus = manifest.contributes.menus;
    const inline = (menus["view/item/context"] ?? []).filter((entry) => entry.group === "inline" && holds(entry.when, "openspec-ui.activeChange"));

    expect(manifest.contributes.submenus ?? []).toEqual([]);
    expect(inline.map((entry) => entry.command)).toEqual(["openspec-ui.showActions"]);
    expect(actions.length).toBeGreaterThan(0);
  });
});
