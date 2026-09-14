import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";
import { collectHumanOnlyInbox } from "./human-only-inbox.js";
import type { AuditEntry } from "./security.js";

// a-change-says-where-it-stands 8.5. A workspace of one small change and a
// seam for the audit entries: no git, no process.
vi.setConfig({ testTimeout: 20_000 });

const roots: string[] = [];

afterEach(async () => {
  await Promise.all(roots.splice(0).map((root) => rm(root, { recursive: true, force: true })));
});

function reply(taskNumber: string, at: string, body: string, outcome: "left-open" | "failed" | "closed"): AuditEntry {
  return {
    runId: `run-${at}`,
    agent: "copilot-cli",
    outcome: "message",
    cwd: "/repo",
    timestamp: at,
    changeDir: path.join("/repo", "openspec", "changes", "demo"),
    taskNumber,
    message: { id: `m-${at}`, kind: "reply", inReplyTo: "m-0", from: { agent: "copilot-cli" }, to: { person: "ada@example.com" }, at, body, outcome },
  };
}

describe("collectHumanOnlyInbox — a delegated item's reply", () => {
  it("attaches the latest reply to the item it answers, and to no other", async () => {
    const root = await mkdtemp(path.join(os.tmpdir(), "openspec-inbox-reply-"));
    roots.push(root);
    await mkdir(path.join(root, "openspec", "specs"), { recursive: true });
    await writeFile(path.join(root, "openspec", "config.yaml"), "schema: spec-driven\n", "utf8");
    const dir = path.join(root, "openspec", "changes", "demo");
    await mkdir(dir, { recursive: true });
    await writeFile(path.join(dir, "proposal.md"), "## Why\n\nBecause.\n", "utf8");
    await writeFile(
      path.join(dir, "tasks.md"),
      "- [ ] 2.1 **Delegated to copilot-cli**: check the server\n- [ ] 2.2 **Delegated to copilot-cli**: check the client\n",
      "utf8",
    );

    const inbox = await collectHumanOnlyInbox(root, {
      readEnrolments: async () => [],
      readAuditEntries: async () => [
        reply("2.1", "2026-09-14T00:00:00.000Z", "first answer", "left-open"),
        reply("2.1", "2026-09-14T00:05:00.000Z", "second answer", "failed"),
      ],
    });

    expect(inbox.items[0]?.reply).toEqual({ at: "2026-09-14T00:05:00.000Z", body: "second answer", outcome: "failed" });
    expect(inbox.items[1]?.reply).toBeUndefined();
  });
});
