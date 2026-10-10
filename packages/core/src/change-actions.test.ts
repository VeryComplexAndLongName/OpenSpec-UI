import { describe, expect, it } from "vitest";
import { ACTION_GROUPS } from "./action-vocabulary.js";
import { CHANGE_ACTIONS, changeActionStates, isChangeActionId, type ChangeActionFacts } from "./change-actions.js";

// a-change-is-acted-on-from-its-card (ADR 0044).

function stateOf(facts: ChangeActionFacts, id: string) {
  return changeActionStates(facts).find((state) => state.action.id === id);
}

const idle: ChangeActionFacts = { where: "checkout", running: false, openTasks: 0 };

describe("the actions on a change", () => {
  it("lists each once, by group in the order the surfaces show them, each with an icon of its own", () => {
    const ids = CHANGE_ACTIONS.map((entry) => entry.id);
    expect(ids.filter((id, index) => ids.indexOf(id) !== index)).toEqual([]);
    const order = ACTION_GROUPS.map((group) => group.group);
    const groups = CHANGE_ACTIONS.map((entry) => order.indexOf(entry.group));
    expect(groups).toEqual([...groups].sort((a, b) => a - b));
    const icons = CHANGE_ACTIONS.map((entry) => entry.icon);
    expect(icons.filter((icon, index) => icons.indexOf(icon) !== index)).toEqual([]);
  });

  it("asks before every Danger action, and only before those", () => {
    expect(CHANGE_ACTIONS.filter((entry) => entry.confirm).map((entry) => entry.id)).toEqual(["archiveChange", "rollbackChange", "deleteChange"]);
  });

  it("offers every action wherever the change is worked, and refuses only the writing ones where the records do not check out", () => {
    const inWorktree = changeActionStates({ ...idle, where: "worktree" });
    expect(inWorktree.filter((state) => !state.enabled).map((state) => state.action.id)).toEqual(["sendMessage", "stopRun"]);

    const unverified = changeActionStates({ ...idle, where: "unverified" });
    expect(unverified.length).toBe(CHANGE_ACTIONS.length);
    expect(stateOf({ ...idle, where: "unverified" }, "configureChangeHarness")).toMatchObject({ enabled: false, reason: expect.stringContaining("do not check out") });
    expect(stateOf({ ...idle, where: "unverified" }, "showDiff")).toMatchObject({ enabled: true });
  });

  it("says why an action cannot run now", () => {
    expect(stateOf(idle, "stopRun")).toMatchObject({ enabled: false, reason: "No run of this change is going." });
    expect(stateOf(idle, "openWorktree")).toMatchObject({ enabled: false, reason: "This change is worked in this checkout." });
    expect(stateOf({ ...idle, openTasks: 2 }, "archiveChange")).toMatchObject({ enabled: false, reason: "2 task(s) are still open." });
    const running = { ...idle, running: true };
    expect(stateOf(running, "deleteChange")).toMatchObject({ enabled: false, reason: "A run of this change is going: stop it first." });
    expect(stateOf(running, "runChange")).toMatchObject({ enabled: false });
    expect(stateOf(running, "sendMessage")).toMatchObject({ enabled: true });
  });

  it("commits a change only on its own branch, and not while a run of it commits as it goes", () => {
    // a-change-is-committed-where-it-is-made.
    expect(stateOf(idle, "commitChange")).toMatchObject({ enabled: false, reason: "This change is worked in this checkout, not on a branch of its own." });
    expect(stateOf({ ...idle, where: "worktree", notOnServer: true }, "commitChange")).toMatchObject({ enabled: true });
    expect(stateOf({ ...idle, where: "worktree", running: true }, "commitChange")).toMatchObject({ enabled: false, reason: "A run of this change is going: stop it first." });
  });

  it("archives a change whose open tasks were not read, and leaves the refusal to the archive", () => {
    expect(stateOf({ where: "checkout", running: false }, "archiveChange")).toMatchObject({ enabled: true });
  });

  it("knows its own ids, and nothing else", () => {
    expect(isChangeActionId("archiveChange")).toBe(true);
    expect(isChangeActionId("deleteWorkspace")).toBe(false);
    expect(isChangeActionId(42)).toBe(false);
  });
});
