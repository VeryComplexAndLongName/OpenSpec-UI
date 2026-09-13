import { mkdir, mkdtemp, readFile, readdir, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  AGENT_STATUS_STALE_AFTER_MS,
  AGENT_STATUS_STREAM_WRITE_INTERVAL_MS,
  AGENT_STATUS_VERSION,
  AgentStatusWriter,
  agentStatusDirectory,
  readAgentStatuses,
  reportEventsToAgentStatus,
  resolveAgentStatusDirectory,
  withAgentStatus,
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
    // Resolved, not written as a drive letter: `C:` is an absolute root on
    // Windows and a relative name everywhere else, which is how this test
    // passed on the machine it was written on and failed in CI.
    const worktreeRoot = path.resolve("worktrees");
    const repositoryRoot = path.resolve("projects", "openspec-ui");
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

  // The Harness's own verify stage found both of these: a chunk's last
  // line became the activity even when the chunk ended mid-word, and every
  // chunk rewrote the record.
  it("takes the activity from a complete line, never from a chunk cut mid-word", async () => {
    const root = await temporaryRoot();
    const directory = path.join(root, ".agent-status");
    let clock = Date.parse("2026-01-01T00:00:00.000Z");
    // Every reading of the clock is two seconds later, so no write is held
    // back by the interval and the test sees each activity that is noted.
    const writer = new AgentStatusWriter({ directory, workingDirectory: root, now: () => new Date((clock += 2_000)) });
    await writer.start("starting");
    const lineBreak = String.fromCharCode(10);

    const events: Event[] = [
      { kind: "stdout", runId: "r1", timestamp: "t", chunk: "Reading the fi" },
      { kind: "stdout", runId: "r1", timestamp: "t", chunk: `le${lineBreak}Writing the ans` },
    ];
    for await (const _event of reportEventsToAgentStatus(eventsOf(events), writer)) {
      // draining
    }

    const { reports } = await readAgentStatuses(directory, { now: () => new Date(clock) });
    expect(reports[0]?.activity).toBe("Reading the file");
    await writer.stop();
  });

  it("takes an unfinished reply as said once something else happens", async () => {
    const root = await temporaryRoot();
    const directory = path.join(root, ".agent-status");
    let clock = Date.parse("2026-01-01T00:00:00.000Z");
    const writer = new AgentStatusWriter({ directory, workingDirectory: root, now: () => new Date((clock += 2_000)) });
    await writer.start("starting");

    const chunk = (text: string): Event => ({
      kind: "agentUpdate",
      runId: "r1",
      timestamp: "t",
      update: { sessionUpdate: "agent_message_chunk", content: { type: "text", text } },
    });
    const events: Event[] = [
      chunk("All tasks "),
      chunk("are done."),
      { kind: "usageReported", runId: "r1", timestamp: "t", usage: { costUsd: 0.1 } },
    ];
    for await (const _event of reportEventsToAgentStatus(eventsOf(events), writer)) {
      // draining
    }

    const { reports } = await readAgentStatuses(directory, { now: () => new Date(clock) });
    expect(reports[0]?.activity).toBe("All tasks are done.");
    await writer.stop();
  });
});

describe("AgentStatusWriter — streamed activity", () => {
  it("rewrites the record for streamed activity at most once per interval, and still moves activityAt at once", async () => {
    const root = await temporaryRoot();
    const directory = path.join(root, ".agent-status");
    let now = new Date("2026-01-01T00:00:00.000Z");
    const writer = new AgentStatusWriter({ directory, workingDirectory: root, now: () => now });
    await writer.start("starting");

    now = new Date(now.getTime() + 10);
    await writer.noteStreamedActivity("line one");
    const heldBack = JSON.parse(await readFile(writer.filePath, "utf8")) as AgentStatusDocument;
    expect(heldBack.activity).toBe("starting");

    now = new Date(now.getTime() + AGENT_STATUS_STREAM_WRITE_INTERVAL_MS);
    await writer.noteStreamedActivity("line two");
    const written = JSON.parse(await readFile(writer.filePath, "utf8")) as AgentStatusDocument;
    expect(written.activity).toBe("line two");
    expect(written.activityAt).toBe(now.toISOString());

    await writer.stop();
  });
});

describe("withAgentStatus", () => {
  const lineBreak = String.fromCharCode(10);

  it("keeps a record for a run, named by the change its command is for, and removes it on a clean end", async () => {
    const root = await temporaryRoot();
    const directory = path.join(root, ".agent-status");
    const command = { kind: "chain" as const, cwd: root, context: { changeDir: path.join(root, "openspec", "changes", "a-change") } };
    let finish: () => void = () => undefined;
    const finished = new Promise<void>((resolve) => {
      finish = resolve;
    });

    async function* source(): AsyncGenerator<Event> {
      yield { kind: "stageStarted", runId: "r1", timestamp: "t", stage: "apply", agentId: "claude-cli-acp" };
      yield { kind: "stdout", runId: "r1", timestamp: "t", chunk: `working${lineBreak}` };
      await finished;
      yield { kind: "completed", runId: "r1", timestamp: "t" };
    }

    const draining = (async () => {
      for await (const _event of withAgentStatus(source(), command, { resolveDirectory: async () => directory })) {
        // draining
      }
    })();

    await vi.waitFor(async () => {
      const { reports } = await readAgentStatuses(directory);
      expect(reports[0]).toMatchObject({ changeName: "a-change", stage: "apply" });
    });

    finish();
    await draining;
    expect((await readAgentStatuses(directory)).reports).toHaveLength(0);
  });

  it("passes a command that is not a run straight through, starting no record", async () => {
    const events: Event[] = [{ kind: "cancelled", runId: "r1", timestamp: "t" }];
    async function* source(): AsyncGenerator<Event> {
      yield* events;
    }
    let resolved = false;
    const seen: Event[] = [];
    for await (const event of withAgentStatus(
      source(),
      { kind: "cancel", cwd: "/repo", context: { changeDir: "/repo/openspec/changes/a-change" } },
      {
        resolveDirectory: async () => {
          resolved = true;
          return "/nowhere";
        },
      },
    )) {
      seen.push(event);
    }

    expect(seen).toEqual(events);
    expect(resolved).toBe(false);
  });

  it("delivers the run's events without waiting for the status directory to be found", async () => {
    const root = await temporaryRoot();
    const directory = path.join(root, ".agent-status");
    let release: (directory: string) => void = () => undefined;
    const found = new Promise<string>((resolve) => {
      release = resolve;
    });

    async function* source(): AsyncGenerator<Event> {
      yield { kind: "started", runId: "r1", timestamp: "t", command: "implement", cwd: root };
      yield { kind: "completed", runId: "r1", timestamp: "t" };
    }

    const iterator = withAgentStatus(
      source(),
      { kind: "implement", cwd: root, context: { changeDir: path.join(root, "openspec", "changes", "a-change") } },
      { resolveDirectory: () => found },
    );
    // Both events arrive while the directory is still being looked for.
    expect((await iterator.next()).value).toMatchObject({ kind: "started" });
    expect((await iterator.next()).value).toMatchObject({ kind: "completed" });

    release(directory);
    expect((await iterator.next()).done).toBe(true);
    // The run ended before its record was ready; the record it then
    // started is removed by the terminal event it was told about.
    expect((await readAgentStatuses(directory)).reports).toHaveLength(0);
  });

  it("lets the run go on unreported when no status directory can be found", async () => {
    const events: Event[] = [
      { kind: "stageStarted", runId: "r1", timestamp: "t", stage: "apply", agentId: "claude-cli" },
      { kind: "completed", runId: "r1", timestamp: "t" },
    ];
    async function* source(): AsyncGenerator<Event> {
      yield* events;
    }
    const seen: Event[] = [];
    for await (const event of withAgentStatus(
      source(),
      { kind: "chain", cwd: "/repo", context: { changeDir: "/repo/openspec/changes/a-change" } },
      {
        resolveDirectory: async () => {
          throw new Error("not a git repository");
        },
      },
    )) {
      seen.push(event);
    }

    expect(seen).toEqual(events);
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
