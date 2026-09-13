import { mkdir, mkdtemp, readFile, readdir, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  AGENT_STATUS_STALE_AFTER_MS,
  AGENT_STATUS_VERSION,
  AgentStatusWriter,
  agentStatusDirectory,
  readAgentStatuses,
  reportEventsToAgentStatus,
  resolveAgentStatusDirectory,
  type AgentStatusDocument,
} from "./agent-status.js";
import type { Event } from "./protocol.js";

// every-varying-check-has-a-budget:
// measured 2026-09-13 for this file alone at 0.2s idle; the concurrent
// write/read test is the one whose real filesystem races vary with load,
// so it gets the same generous budget workspace-lease.test.ts uses for
// the same reason.
vi.setConfig({ testTimeout: 15_000 });

const roots: string[] = [];

async function temporaryRoot(): Promise<string> {
  const root = await mkdtemp(path.join(os.tmpdir(), "openspec-ui-agent-status-"));
  roots.push(root);
  return root;
}

afterEach(async () => {
  await Promise.all(roots.splice(0).map((root) => rm(root, { recursive: true, force: true })));
});

describe("agentStatusDirectory", () => {
  it("sits beside the repository's working directories, not inside one", () => {
    const worktreeRoot = path.join("C:", "worktrees");
    const repositoryRoot = path.join("C:", "projects", "openspec-ui");
    const directory = agentStatusDirectory(worktreeRoot, repositoryRoot);
    expect(directory).toBe(path.join(worktreeRoot, "openspec-ui", ".agent-status"));
  });
});

describe("resolveAgentStatusDirectory", () => {
  it("resolves from the main working tree, so a run in a change's own worktree and a run from the main checkout share one directory", async () => {
    const root = await temporaryRoot();
    const mainPath = path.join(root, "openspec-ui");
    const worktreePath = path.join(root, "openspec-ui-worktrees", "some-change");
    const env = { OPENSPEC_UI_WORKTREE_ROOT: path.join(root, "shared-worktree-root") };
    const git = { worktreeList: async () => [{ path: mainPath }] };

    const fromMain = await resolveAgentStatusDirectory(git, mainPath, { env });
    const fromWorktree = await resolveAgentStatusDirectory(git, worktreePath, { env });

    expect(fromMain).toBe(fromWorktree);
    expect(fromMain).toBe(path.join(env.OPENSPEC_UI_WORKTREE_ROOT, "openspec-ui", ".agent-status"));
  });
});

describe("reportEventsToAgentStatus", () => {
  async function* eventsOf(events: Event[]): AsyncGenerator<Event> {
    for (const event of events) yield event;
  }

  it("carries stage transitions and the latest streamed line into the record, and yields events through unchanged", async () => {
    const root = await temporaryRoot();
    const directory = path.join(root, ".agent-status");
    const writer = new AgentStatusWriter({ directory, workingDirectory: root, changeName: "a-change" });
    await writer.start();

    const events: Event[] = [
      { kind: "stageStarted", runId: "r1", timestamp: "2026-01-01T00:00:00.000Z", stage: "apply", agentId: "claude-cli" },
      { kind: "stdout", runId: "r1", timestamp: "2026-01-01T00:00:01.000Z", chunk: "line one\nline two\n" },
      { kind: "progress", runId: "r1", timestamp: "2026-01-01T00:00:02.000Z", message: "42% done" },
      { kind: "stageCompleted", runId: "r1", timestamp: "2026-01-01T00:00:03.000Z", stage: "apply", nextStage: "verify" },
    ];

    const seen: Event[] = [];
    for await (const event of reportEventsToAgentStatus(eventsOf(events), writer)) seen.push(event);
    expect(seen).toEqual(events);

    const { reports } = await readAgentStatuses(directory);
    expect(reports[0]?.stage).toBe("verify");
    expect(reports[0]?.activity).toBe("running verify");

    await writer.stop();
  });

  it("removes the record when the run ends cleanly", async () => {
    const root = await temporaryRoot();
    const directory = path.join(root, ".agent-status");
    const writer = new AgentStatusWriter({ directory, workingDirectory: root });
    await writer.start();

    const events: Event[] = [{ kind: "completed", runId: "r1", timestamp: "2026-01-01T00:00:00.000Z" }];
    for await (const _event of reportEventsToAgentStatus(eventsOf(events), writer)) {
      // draining the generator
    }

    const { reports } = await readAgentStatuses(directory);
    expect(reports).toHaveLength(0);
  });

  it("leaves the record behind when the stream ends without a terminal event", async () => {
    const root = await temporaryRoot();
    const directory = path.join(root, ".agent-status");
    const writer = new AgentStatusWriter({ directory, workingDirectory: root });
    await writer.start();

    const events: Event[] = [{ kind: "progress", runId: "r1", timestamp: "2026-01-01T00:00:00.000Z", message: "working" }];
    for await (const _event of reportEventsToAgentStatus(eventsOf(events), writer)) {
      // a crash leaves nothing after this — no completed/failed/cancelled follows
    }

    const { reports } = await readAgentStatuses(directory);
    expect(reports).toHaveLength(1);
    await writer.stop();
  });
});

describe("AgentStatusWriter", () => {
  it("writes a record naming itself, its change, and its working directory", async () => {
    const root = await temporaryRoot();
    const directory = path.join(root, ".agent-status");
    const workingDirectory = path.join(root, "some-change");
    const writer = new AgentStatusWriter({ directory, workingDirectory, changeName: "some-change" });

    await writer.start("planning");
    const raw = await readFile(writer.filePath, "utf8");
    const document = JSON.parse(raw) as AgentStatusDocument;
    expect(document).toMatchObject({
      version: AGENT_STATUS_VERSION,
      instanceId: writer.instanceId,
      activity: "planning",
      changeName: "some-change",
      workingDirectory,
    });
    await writer.stop();
  });

  it("two runs by one person write two records and neither overwrites the other", async () => {
    const root = await temporaryRoot();
    const directory = path.join(root, ".agent-status");
    const first = new AgentStatusWriter({ directory, workingDirectory: root, changeName: "change-a" });
    const second = new AgentStatusWriter({ directory, workingDirectory: root, changeName: "change-b" });

    await first.start("working on a");
    await second.start("working on b");

    const entries = await readdir(directory);
    expect(entries.sort()).toEqual([`${first.instanceId}.json`, `${second.instanceId}.json`].sort());

    const { reports } = await readAgentStatuses(directory);
    expect(reports).toHaveLength(2);
    expect(reports.find((r) => r.instanceId === first.instanceId)?.changeName).toBe("change-a");
    expect(reports.find((r) => r.instanceId === second.instanceId)?.changeName).toBe("change-b");

    await first.stop();
    await second.stop();
  });

  it("a working directory's removal leaves the record intact", async () => {
    const root = await temporaryRoot();
    const directory = path.join(root, ".agent-status");
    const workingDirectory = path.join(root, "worktree-for-a-change");
    await mkdir(workingDirectory, { recursive: true });
    const writer = new AgentStatusWriter({ directory, workingDirectory, changeName: "a-change" });
    await writer.start("doing something");

    await rm(workingDirectory, { recursive: true, force: true });

    const { reports } = await readAgentStatuses(directory);
    expect(reports).toHaveLength(1);
    expect(reports[0]?.workingDirectory).toBe(workingDirectory);
    await writer.stop();
  });

  it("removes its record on a clean stop", async () => {
    const root = await temporaryRoot();
    const directory = path.join(root, ".agent-status");
    const writer = new AgentStatusWriter({ directory, workingDirectory: root });
    await writer.start();
    await writer.stop();

    const { reports } = await readAgentStatuses(directory);
    expect(reports).toHaveLength(0);
  });

  it("moves activityAt only when the reported activity actually changes", async () => {
    const root = await temporaryRoot();
    const directory = path.join(root, ".agent-status");
    let now = new Date("2026-01-01T00:00:00.000Z");
    const writer = new AgentStatusWriter({ directory, workingDirectory: root, now: () => now });

    await writer.start("first activity");
    const firstDocument = JSON.parse(await readFile(writer.filePath, "utf8")) as AgentStatusDocument;

    now = new Date(now.getTime() + 5_000);
    await writer.reportActivity("first activity");
    const unchangedDocument = JSON.parse(await readFile(writer.filePath, "utf8")) as AgentStatusDocument;
    expect(unchangedDocument.activityAt).toBe(firstDocument.activityAt);
    expect(unchangedDocument.heartbeatAt).not.toBe(firstDocument.heartbeatAt);

    now = new Date(now.getTime() + 5_000);
    await writer.reportActivity("second activity");
    const changedDocument = JSON.parse(await readFile(writer.filePath, "utf8")) as AgentStatusDocument;
    expect(changedDocument.activityAt).not.toBe(firstDocument.activityAt);

    await writer.stop();
  });

  it("is never observed half-written under concurrent writes and reads", async () => {
    const root = await temporaryRoot();
    const directory = path.join(root, ".agent-status");
    const writer = new AgentStatusWriter({ directory, workingDirectory: root });
    await writer.start("activity 0");

    let sawMalformed = false;
    const writes = (async () => {
      for (let i = 1; i <= 30; i += 1) {
        await writer.reportActivity(`activity ${i}`);
      }
    })();
    const reads = (async () => {
      for (let i = 0; i < 30; i += 1) {
        const { malformed } = await readAgentStatuses(directory);
        if (malformed.length > 0) sawMalformed = true;
      }
    })();
    await Promise.all([writes, reads]);

    expect(sawMalformed).toBe(false);
    await writer.stop();
  });
});

describe("readAgentStatuses", () => {
  it("reports a heartbeat older than the staleness window as gone", async () => {
    const root = await temporaryRoot();
    const directory = path.join(root, ".agent-status");
    await mkdir(directory, { recursive: true });
    const staleHeartbeat = new Date(Date.now() - AGENT_STATUS_STALE_AFTER_MS - 1_000).toISOString();
    const document: AgentStatusDocument = {
      version: AGENT_STATUS_VERSION,
      instanceId: "gone-run",
      activity: "was doing something",
      stage: null,
      changeName: null,
      workingDirectory: root,
      activityAt: staleHeartbeat,
      heartbeatAt: staleHeartbeat,
    };
    await writeFile(path.join(directory, "gone-run.json"), JSON.stringify(document), "utf8");

    const { reports } = await readAgentStatuses(directory);
    expect(reports).toHaveLength(1);
    expect(reports[0]?.gone).toBe(true);
  });

  it("reports a record whose stated identity does not match its file name, rather than reading it as that run's", async () => {
    const root = await temporaryRoot();
    const directory = path.join(root, ".agent-status");
    await mkdir(directory, { recursive: true });
    const now = new Date().toISOString();
    const document: AgentStatusDocument = {
      version: AGENT_STATUS_VERSION,
      instanceId: "someone-elses-id",
      activity: "doing something",
      stage: null,
      changeName: null,
      workingDirectory: root,
      activityAt: now,
      heartbeatAt: now,
    };
    await writeFile(path.join(directory, "this-run-id.json"), JSON.stringify(document), "utf8");

    const { reports, malformed } = await readAgentStatuses(directory);
    expect(reports).toHaveLength(0);
    expect(malformed).toHaveLength(1);
    expect(malformed[0]?.fileName).toBe("this-run-id.json");
    expect(malformed[0]?.reason).toContain("someone-elses-id");
  });

  it("reports a malformed record and the others survive", async () => {
    const root = await temporaryRoot();
    const directory = path.join(root, ".agent-status");
    await mkdir(directory, { recursive: true });
    await writeFile(path.join(directory, "broken.json"), "{not json", "utf8");
    const now = new Date().toISOString();
    const good: AgentStatusDocument = {
      version: AGENT_STATUS_VERSION,
      instanceId: "good-run",
      activity: "doing something",
      stage: "apply",
      changeName: "a-change",
      workingDirectory: root,
      activityAt: now,
      heartbeatAt: now,
    };
    await writeFile(path.join(directory, "good-run.json"), JSON.stringify(good), "utf8");

    const { reports, malformed } = await readAgentStatuses(directory);
    expect(malformed).toEqual([{ fileName: "broken.json", reason: "not valid JSON" }]);
    expect(reports).toHaveLength(1);
    expect(reports[0]?.instanceId).toBe("good-run");
  });

  it("reads an absent directory as no runs, not an error", async () => {
    const root = await temporaryRoot();
    const { reports, malformed } = await readAgentStatuses(path.join(root, "never-created"));
    expect(reports).toEqual([]);
    expect(malformed).toEqual([]);
  });

  it("reports how long since activity changed, and states no verdict anywhere in the shape", async () => {
    const root = await temporaryRoot();
    const directory = path.join(root, ".agent-status");
    await mkdir(directory, { recursive: true });
    const activityAt = new Date(Date.now() - 60_000).toISOString();
    const heartbeatAt = new Date().toISOString();
    const document: AgentStatusDocument = {
      version: AGENT_STATUS_VERSION,
      instanceId: "quiet-run",
      activity: "still thinking",
      stage: "apply",
      changeName: "a-change",
      workingDirectory: root,
      activityAt,
      heartbeatAt,
    };
    await writeFile(path.join(directory, "quiet-run.json"), JSON.stringify(document), "utf8");

    const { reports } = await readAgentStatuses(directory);
    expect(reports).toHaveLength(1);
    expect(reports[0]?.activitySinceMs).toBeGreaterThanOrEqual(59_000);
    expect(reports[0]?.gone).toBe(false);

    // The whole reported shape, not just the field a lazier assertion
    // would pick — this is the field somebody will helpfully add later.
    const shape = JSON.stringify(reports[0]).toLowerCase();
    expect(shape).not.toContain("stuck");
    expect(shape).not.toContain("hung");
    expect(shape).not.toContain("unhealthy");
    expect(shape).not.toContain("healthy");
  });
});
