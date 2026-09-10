import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";
import { collectHumanOnlyInbox, describeHumanOnlyInbox, describeWaitingOn } from "./human-only-inbox.js";
import type { HumanOnlyItem } from "./human-only-inbox.js";

// human-only-inbox-in-the-shell, a-live-check-names-who-performs-it:
// touches the filesystem — a workspace of small changes, no git, no
// processes. Measured 2026-09-10 on an idle machine: 159ms and 156ms of
// test time across two runs, 2.5-2.7s wall clock including transform and
// collection. The ceiling below is sized for a loaded machine rather
// than for that figure — a budget sized to an idle measurement reports
// contention as a failure (LIMITS.md, "a budget is a ceiling, not a
// target").
vi.setConfig({ testTimeout: 20_000 });

const roots: string[] = [];

afterEach(async () => {
  await Promise.all(roots.splice(0).map((root) => rm(root, { recursive: true, force: true })));
});

async function workspaceWith(changes: Record<string, string>): Promise<string> {
  const root = await mkdtemp(path.join(os.tmpdir(), "openspec-inbox-"));
  roots.push(root);
  await mkdir(path.join(root, "openspec", "specs"), { recursive: true });
  await writeFile(path.join(root, "openspec", "config.yaml"), "schema: spec-driven\n", "utf8");
  for (const [name, tasks] of Object.entries(changes)) {
    const dir = path.join(root, "openspec", "changes", name);
    await mkdir(dir, { recursive: true });
    await writeFile(path.join(dir, "proposal.md"), "## Why\n\nBecause.\n", "utf8");
    await writeFile(path.join(dir, "tasks.md"), tasks, "utf8");
  }
  return root;
}

function person(changeName: string, lineNumber: number): HumanOnlyItem {
  return { changeName, changeDir: `/${changeName}`, lineNumber, text: "x", waitingOn: { kind: "person" } };
}

function agent(changeName: string, lineNumber: number, name: string, known = true): HumanOnlyItem {
  return {
    changeName,
    changeDir: `/${changeName}`,
    lineNumber,
    text: "x",
    waitingOn: { kind: "agent", agent: name, known },
  };
}

describe("collectHumanOnlyInbox", () => {
  it("finds what is waiting on a person, across changes, naming each one", async () => {
    const root = await workspaceWith({
      "change-a": "- [ ] 1.1 Ordinary\n- [ ] 1.2 **Human-only**: look at it\n",
      "change-b": "- [ ] 2.1 **Human-only**: and this\n",
    });

    const inbox = await collectHumanOnlyInbox(root);

    expect(inbox.items.map((item) => item.changeName)).toEqual(["change-a", "change-b"]);
    expect(inbox.items[0]?.text).toContain("look at it");
    expect(inbox.items[0]?.waitingOn).toEqual({ kind: "person" });
    expect(inbox.changesRead).toBe(2);
  });

  it("carries an item delegated to an agent, saying which", async () => {
    // The point of the delegation: it is still waiting, and it is not
    // waiting on a person. Before this it was one or the other.
    const root = await workspaceWith({
      "change-a": "- [ ] 1.1 **Delegated to copilot-cli**: quote the audit line carrying `--agent`\n",
    });

    const inbox = await collectHumanOnlyInbox(root);

    expect(inbox.items).toHaveLength(1);
    expect(inbox.items[0]?.waitingOn).toEqual({ kind: "agent", agent: "copilot-cli", known: true });
  });

  it("reports an agent the registry does not carry, rather than trusting the name", async () => {
    // An item delegated to nobody looks assigned and is not.
    const root = await workspaceWith({
      "change-a": "- [ ] 1.1 **Delegated to copilto-cli**: a typo nothing will run\n",
    });

    expect((await collectHumanOnlyInbox(root)).items[0]?.waitingOn)
      .toEqual({ kind: "agent", agent: "copilto-cli", known: false });
  });

  it("sends an item marked both ways to a person", async () => {
    // "Nobody can do this" and "this agent does this" cannot both be
    // true, and of the two the safer answer is the one a person sees.
    const root = await workspaceWith({
      "change-a": "- [ ] 1.1 **Human-only**: judge it. **Delegated to copilot-cli**: no\n",
      "change-b": "- [ ] 2.1 **Delegated to copilot-cli**: run it. **Human-only**: also judge it\n",
    });

    const inbox = await collectHumanOnlyInbox(root);

    expect(inbox.items.map((item) => item.waitingOn)).toEqual([{ kind: "person" }, { kind: "person" }]);
  });

  it("leaves out an item already ticked", async () => {
    const root = await workspaceWith({
      "change-a": "- [x] 1.1 **Human-only**: done already\n- [x] 1.2 **Delegated to copilot-cli**: also done\n",
    });

    expect((await collectHumanOnlyInbox(root)).items).toEqual([]);
  });

  it("leaves out an ordinary open task", async () => {
    // The inbox is about what the implementing agent will not close, not
    // about what is unfinished — every active change has some of the
    // latter.
    const root = await workspaceWith({ "change-a": "- [ ] 1.1 Ordinary work\n" });

    expect((await collectHumanOnlyInbox(root)).items).toEqual([]);
  });

  it("leaves out a bold lead that names no agent", async () => {
    // "Delegated to whoever is free" assigns nothing, and reading it as
    // an assignment would be the silent loss this marker exists to stop.
    const root = await workspaceWith({ "change-a": "- [ ] 1.1 **Delegated to whoever is free**: no\n" });

    expect((await collectHumanOnlyInbox(root)).items).toEqual([]);
  });

  it("carries the line so a host can open the file at it", async () => {
    const root = await workspaceWith({ "change-a": "- [ ] 1.1 Ordinary\n- [ ] 1.2 **Human-only**: here\n" });

    expect((await collectHumanOnlyInbox(root)).items[0]?.lineNumber).toBe(1);
  });
});

describe("describeWaitingOn", () => {
  it("names a person, a registered agent, and an unregistered one differently", () => {
    expect(describeWaitingOn({ kind: "person" })).toBe("a person");
    expect(describeWaitingOn({ kind: "agent", agent: "copilot-cli", known: true })).toBe("copilot-cli");
    expect(describeWaitingOn({ kind: "agent", agent: "nope", known: false }))
      .toBe("\"nope\", which is not a registered agent");
  });
});

describe("describeHumanOnlyInbox", () => {
  it("tells an empty workspace apart from one where nothing is waiting", () => {
    // Both show no items, and they are different facts.
    expect(describeHumanOnlyInbox({ items: [], changesRead: 0 })).toContain("No active change");
    expect(describeHumanOnlyInbox({ items: [], changesRead: 3 }))
      .toContain("Nothing is waiting — 3 active changes read");
  });

  it("says how much is waiting and across how many changes", () => {
    const items = [person("a", 1), person("a", 2), person("b", 1)];

    expect(describeHumanOnlyInbox({ items, changesRead: 6 }))
      .toBe("3 items waiting, across 2 of 6 active changes: 3 on a person.");
  });

  it("counts what waits on a person apart from what waits on each agent", () => {
    const items = [
      person("a", 1),
      agent("a", 2, "copilot-cli"),
      agent("b", 1, "copilot-cli"),
      agent("b", 2, "claude-cli"),
    ];

    expect(describeHumanOnlyInbox({ items, changesRead: 4 }))
      .toBe("4 items waiting, across 2 of 4 active changes: 1 on a person, 2 on copilot-cli, 1 on claude-cli.");
  });

  it("names an unregistered agent as such in the count", () => {
    const items = [agent("a", 1, "copilto-cli", false)];

    expect(describeHumanOnlyInbox({ items, changesRead: 1 }))
      .toContain("1 on \"copilto-cli\", which is not a registered agent");
  });
});
