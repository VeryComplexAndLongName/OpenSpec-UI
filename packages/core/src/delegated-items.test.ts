import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";
import { resolveDelegatedItems } from "./delegated-items.js";
import { collectHumanOnlyInbox, describeHumanOnlyInbox } from "./human-only-inbox.js";
import { taskNumberOf } from "./task-checklist.js";

// a-delegated-item-runs-its-agent: touches the filesystem — a workspace
// of one or two small changes, no git and no processes. The ceiling is
// sized for a loaded machine rather than an idle one, as the inbox
// suite beside it already argues.
vi.setConfig({ testTimeout: 20_000 });

const roots: string[] = [];

afterEach(async () => {
  await Promise.all(roots.splice(0).map((root) => rm(root, { recursive: true, force: true })));
});

async function workspaceWith(
  changes: Record<string, { tasks: string; harness?: unknown }>,
): Promise<string> {
  const root = await mkdtemp(path.join(os.tmpdir(), "openspec-delegated-"));
  roots.push(root);
  await mkdir(path.join(root, "openspec", "specs"), { recursive: true });
  await writeFile(path.join(root, "openspec", "config.yaml"), "schema: spec-driven\n", "utf8");
  for (const [name, change] of Object.entries(changes)) {
    const dir = path.join(root, "openspec", "changes", name);
    await mkdir(dir, { recursive: true });
    await writeFile(path.join(dir, "proposal.md"), "## Why\n\nBecause.\n", "utf8");
    await writeFile(path.join(dir, "tasks.md"), change.tasks, "utf8");
    if (change.harness !== undefined) {
      await writeFile(path.join(dir, "harness.json"), `${JSON.stringify(change.harness, null, 2)}\n`, "utf8");
    }
  }
  return root;
}

describe("taskNumberOf", () => {
  it("reads the number a task line leads with, and nothing else", () => {
    expect(taskNumberOf("1.1 Do the thing")).toBe("1.1");
    expect(taskNumberOf("6 **Delegated to copilot-cli**: run it")).toBe("6");
    expect(taskNumberOf("1.2.3 Deeper")).toBe("1.2.3");
    // No leading number at all, and a line whose lead is not a number
    // followed by a break: neither can be named by a `taskAgents` key.
    expect(taskNumberOf("Do the thing")).toBeUndefined();
    expect(taskNumberOf("1.1. Trailing dot")).toBeUndefined();
    expect(taskNumberOf("v2.1 Something")).toBeUndefined();
  });
});

describe("resolveDelegatedItems", () => {
  // One change carrying every case the precedence rule has to settle.
  const TASKS = [
    "- [ ] 1.1 Ordinary work nobody delegated",
    "- [ ] 1.2 **Human-only**: judge whether it reads well",
    "- [ ] 2.1 **Delegated to copilot-cli**: quote the audit line",
    "- [ ] 2.2 Named only in the file",
    "- [ ] 2.3 **Delegated to copilot-cli**: named in both, agreeing",
    "- [ ] 2.4 **Delegated to copilot-cli**: named in both, disagreeing",
    "- [x] 3.1 **Delegated to copilot-cli**: already done",
    "",
  ].join("\n");

  const HARNESS = {
    taskAgents: {
      "2.2": "copilot-cli",
      "2.3": "copilot-cli",
      "2.4": { agent: "claude-cli", model: "sonnet" },
      "9.9": "copilot-cli",
    },
  };

  async function resolved() {
    const root = await workspaceWith({ demo: { tasks: TASKS, harness: HARNESS } });
    return resolveDelegatedItems(root, "demo");
  }

  it("returns every open item naming an agent, and nothing else", async () => {
    const items = (await resolved()).items;

    // 1.1 names nobody, 1.2 waits on a person, 3.1 is done.
    expect(items.map((item) => item.taskNumber)).toEqual(["2.1", "2.2", "2.3", "2.4"]);
  });

  it("says where each name came from", async () => {
    const items = (await resolved()).items;

    expect(items.map((item) => [item.taskNumber, item.agent, item.source])).toEqual([
      ["2.1", "copilot-cli", "task-text"],
      ["2.2", "copilot-cli", "file"],
      ["2.3", "copilot-cli", "file"],
      ["2.4", "claude-cli", "file"],
    ]);
  });

  it("carries the disagreement rather than resolving it in silence", async () => {
    const items = (await resolved()).items;

    // The file wins — and the surface can still say the task text
    // disagrees, which is the point of carrying it.
    expect(items.find((item) => item.taskNumber === "2.4")?.alsoNamedInText).toBe("copilot-cli");
    // Agreement is not a disagreement: nothing to show for 2.3.
    expect(items.find((item) => item.taskNumber === "2.3")?.alsoNamedInText).toBeUndefined();
  });

  it("carries the configured entry, so a model or custom agent reaches the run", async () => {
    const items = (await resolved()).items;

    expect(items.find((item) => item.taskNumber === "2.4")?.entry).toEqual({ agent: "claude-cli", model: "sonnet" });
    expect(items.find((item) => item.taskNumber === "2.1")?.entry).toBe("copilot-cli");
  });

  it("reports a key no open task line carries", async () => {
    expect((await resolved()).unmatched).toEqual([
      { changeName: "demo", taskNumber: "9.9", agent: "copilot-cli", reason: "no-such-open-task" },
    ]);
  });

  it("reports a key naming a task marked for a person, and leaves the item to the person", async () => {
    const root = await workspaceWith({
      demo: {
        tasks: "- [ ] 1.2 **Human-only**: judge whether it reads well\n",
        harness: { taskAgents: { "1.2": "copilot-cli" } },
      },
    });

    const items = await resolveDelegatedItems(root, "demo");

    expect(items.items).toEqual([]);
    expect(items.unmatched).toEqual([
      { changeName: "demo", taskNumber: "1.2", agent: "copilot-cli", reason: "task-waits-on-a-person" },
    ]);
  });

  it("marks an unregistered id as unknown rather than dropping it", async () => {
    const root = await workspaceWith({
      demo: { tasks: "- [ ] 1.1 **Delegated to copilto-cli**: a typo\n" },
    });

    const [item] = (await resolveDelegatedItems(root, "demo")).items;

    expect(item?.agent).toBe("copilto-cli");
    expect(item?.known).toBe(false);
  });

  it("names the change when its harness.json cannot be read", async () => {
    // The caller reads many changes; "Invalid harness config: ..." alone
    // says nothing about which file to open.
    const root = await workspaceWith({
      demo: { tasks: "- [ ] 1.1 x\n", harness: { taskAgents: { "1.1": "nope-cli" } } },
    });

    await expect(resolveDelegatedItems(root, "demo"))
      .rejects.toThrow(/demo\/harness\.json: .*unknown agent id "nope-cli"/);
  });
});

describe("collectHumanOnlyInbox reads the same precedence", () => {
  it("shows the configured agent on the row, and says the task text disagrees", async () => {
    const root = await workspaceWith({
      demo: {
        tasks: "- [ ] 2.4 **Delegated to copilot-cli**: run it\n",
        harness: { taskAgents: { "2.4": "claude-cli" } },
      },
    });

    const inbox = await collectHumanOnlyInbox(root);

    expect(inbox.items[0]?.waitingOn).toEqual({
      kind: "agent",
      agent: "claude-cli",
      known: true,
      source: "file",
      alsoNamedInText: "copilot-cli",
    });
  });

  it("reports an unmatched key in the sentence, where it is otherwise visible nowhere", async () => {
    const root = await workspaceWith({
      demo: { tasks: "- [ ] 1.1 Ordinary\n", harness: { taskAgents: { "9.9": "copilot-cli" } } },
    });

    const inbox = await collectHumanOnlyInbox(root);

    expect(inbox.unmatchedTaskAgents).toEqual([
      { changeName: "demo", taskNumber: "9.9", agent: "copilot-cli", reason: "no-such-open-task" },
    ]);
    expect(describeHumanOnlyInbox(inbox)).toBe(
      "Nothing is waiting — 1 active change read."
      + " 1 taskAgents entry matched no open task: demo names copilot-cli for task 9.9,"
      + " but no open task carries that number.",
    );
  });
});
