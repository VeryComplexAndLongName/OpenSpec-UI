import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";
import { collectHumanOnlyInbox, describeHumanOnlyInbox } from "./human-only-inbox.js";

// human-only-inbox-in-the-shell:
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

describe("collectHumanOnlyInbox", () => {
  it("finds what is waiting on a person, across changes, naming each one", async () => {
    const root = await workspaceWith({
      "change-a": "- [ ] 1.1 Ordinary\n- [ ] 1.2 **Human-only**: look at it\n",
      "change-b": "- [ ] 2.1 **Human-only**: and this\n",
    });

    const inbox = await collectHumanOnlyInbox(root);

    expect(inbox.items.map((item) => item.changeName)).toEqual(["change-a", "change-b"]);
    expect(inbox.items[0]?.text).toContain("look at it");
    expect(inbox.changesRead).toBe(2);
  });

  it("leaves out an item already ticked", async () => {
    const root = await workspaceWith({ "change-a": "- [x] 1.1 **Human-only**: done already\n" });

    expect((await collectHumanOnlyInbox(root)).items).toEqual([]);
  });

  it("leaves out an ordinary open task", async () => {
    // The inbox is about what only a person can close, not about what is
    // unfinished — every active change has some of the latter.
    const root = await workspaceWith({ "change-a": "- [ ] 1.1 Ordinary work\n" });

    expect((await collectHumanOnlyInbox(root)).items).toEqual([]);
  });

  it("carries the line so a host can open the file at it", async () => {
    const root = await workspaceWith({ "change-a": "- [ ] 1.1 Ordinary\n- [ ] 1.2 **Human-only**: here\n" });

    expect((await collectHumanOnlyInbox(root)).items[0]?.lineNumber).toBe(1);
  });
});

describe("describeHumanOnlyInbox", () => {
  it("tells an empty workspace apart from one where nothing is waiting", async () => {
    // Both show no items, and they are different facts.
    expect(describeHumanOnlyInbox({ items: [], changesRead: 0 })).toContain("No active change");
    expect(describeHumanOnlyInbox({ items: [], changesRead: 3 }))
      .toContain("Nothing is waiting on a person — 3 active changes read");
  });

  it("says how much is waiting and across how many changes", async () => {
    const items = [
      { changeName: "a", changeDir: "/a", lineNumber: 1, text: "x" },
      { changeName: "a", changeDir: "/a", lineNumber: 2, text: "y" },
      { changeName: "b", changeDir: "/b", lineNumber: 1, text: "z" },
    ];

    expect(describeHumanOnlyInbox({ items, changesRead: 6 }))
      .toBe("3 items waiting on a person, across 2 of 6 active changes.");
  });
});
