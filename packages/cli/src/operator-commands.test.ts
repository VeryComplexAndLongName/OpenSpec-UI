import { mkdtemp, readFile, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";
import { generateKeyPairSync, sign } from "node:crypto";
import {
  AgentStatusWriter, WorkbenchRecoveryService, keyIdOf, readAgentStatuses,
  readMessagesFor, messageDirectoryBeside,
  type AgentRunner, type Command, runOwnDelegatedItem
} from "@openspec-ui/core";
import { rollbackCommand } from "./rollback-command.js";
import { runTaskCommand } from "./task-command.js";
import { sendMessageCommand, queueNote } from "./send-message-command.js";
import { ReportRefusal } from "./report-command.js";

const options = { workspaceRoot: "/repo", changeName: "demo", format: "json" as const };
const io = () => ({ stdout: vi.fn(), stderr: vi.fn() });
vi.setConfig({ testTimeout: 15_000 });
const roots: string[] = [];
afterEach(async () => { await Promise.all(roots.splice(0).map((root) => rm(root, { recursive: true, force: true }))); });

async function rollbackFixture() {
  const root = await mkdtemp(path.join(os.tmpdir(), "cli-rollback-"));
  roots.push(root);
  const source = vi.fn().mockResolvedValue({ ok: true, path: root });
  const restore = vi.fn().mockResolvedValue({ restored: ["tracked.txt"], conflicts: [] });
  const details = vi.fn().mockResolvedValue({ fileCount: 1, processCount: 1 });
  const open = vi.fn().mockResolvedValue({ changeRollbackDetails: details, rollbackChange: restore });
  return { root, source, restore, details, open };
}

describe("operator commands", () => {
  it("refuses rollback without a terminal before reading or writing", async () => {
    const source = vi.fn();
    const output = io();
    expect(await rollbackCommand(options, { ...output, confirmation: {}, source })).toBe(1);
    expect(source).not.toHaveBeenCalled();
    expect(output.stdout).not.toHaveBeenCalled();
  });
  it("refuses an ordinary task before dispatch", async () => {
    const run = vi.fn();
    expect(await runTaskCommand({ ...options, number: "1.1" }, {
      ...io(), permission: {}, run,
      find: vi.fn().mockResolvedValue({ ok: true, item: { text: "1.1 ordinary", done: false, lineNumber: 1 } }),
    })).toBe(1);
    expect(run).not.toHaveBeenCalled();
  });
  it("reports notes as queued, never delivered", async () => {
    const output = io();
    expect(await sendMessageCommand({ ...options, words: "Please inspect" }, output,
      vi.fn().mockResolvedValue({ messageId: "m1", to: "instance", author: "person", status: "queued" }))).toBe(0);
    expect(JSON.parse(output.stdout.mock.calls[0]![0])).toMatchObject({ status: "queued", messageId: "m1" });
  });
  it("refuses blank notes before resolving the target", async () => {
    const directory = vi.fn();
    await expect(queueNote({ ...options, words: "  \n" }, { directory })).rejects.toThrow("non-blank");
    expect(directory).not.toHaveBeenCalled();
  });
  it("refuses expired or unverified targets before loading a signing key", async () => {
    const loadKey = vi.fn();
    const read = vi.fn().mockResolvedValue({
      reports: [
        { instanceId: "expired", gone: true, signature: "verified" },
        { instanceId: "unverified", gone: false, signature: "does-not-check-out" },
      ], malformed: []
    });
    for (const changeName of ["expired", "unverified"]) {
      await expect(queueNote({ ...options, changeName, words: "Please inspect" }, {
        directory: async () => "/repo/.agent-status", read, loadKey,
      })).rejects.toBeInstanceOf(ReportRefusal);
    }
    expect(loadKey).not.toHaveBeenCalled();
  });

  it("writes a signed note accepted by the core receiver without claiming agent approval", async () => {
    const root = await mkdtemp(path.join(os.tmpdir(), "cli-note-"));
    roots.push(root);
    const { privateKey, publicKey } = generateKeyPairSync("ed25519");
    const key = {
      keyId: keyIdOf(publicKey), publicKeyPem: publicKey.export({ type: "spki", format: "pem" }).toString(),
      publicKey: publicKey.export({ type: "spki", format: "der" }).toString("base64"),
      sign: (bytes: Uint8Array) => new Uint8Array(sign(null, bytes, privateKey)),
    };
    const statusDirectory = path.join(root, ".agent-status");
    const result = await queueNote({ ...options, changeName: "instance", words: "Please inspect" }, {
      directory: async () => statusDirectory,
      read: vi.fn().mockResolvedValue({ reports: [{ instanceId: "instance", gone: false, signature: "verified" }], malformed: [] }),
      loadKey: async () => key, tty: true, agent: "", gitAuthor: "Fixture",
    });
    expect(result.author).toBe("person");
    const roster = new Map([[key.keyId, { keyId: key.keyId, publicKey: key.publicKey, label: "Fixture" }]]);
    const received = await readMessagesFor({ directory: messageDirectoryBeside(statusDirectory), to: "instance", roster, seen: new Set(), now: new Date() });
    expect(received[0]).toMatchObject({ state: "act", message: { messageId: result.messageId, words: "Please inspect", author: "person" } });
  });

  it("restores only after confirmation while holding and releasing the mutation lease", async () => {
    const fixture = await rollbackFixture();
    const ask = vi.fn(async () => {
      expect(await readFile(path.join(fixture.root, ".openspec-ui", "workspace.lease.json"), "utf8")).toContain("cli");
      return true;
    });
    expect(await rollbackCommand(options, { ...io(), ...fixture, confirmation: { ask }, busy: async () => false })).toBe(0);
    expect(ask).toHaveBeenCalledOnce();
    expect(fixture.restore).toHaveBeenCalledWith("demo");
    await expect(readFile(path.join(fixture.root, ".openspec-ui", "workspace.lease.json"))).rejects.toThrow();
  });

  it.each(["declined", "busy", "no-checkpoints", "conflict"])("refuses %s recovery without overriding protections", async (cause) => {
    const fixture = await rollbackFixture();
    if (cause === "no-checkpoints") fixture.details.mockResolvedValue(undefined);
    if (cause === "conflict") fixture.restore.mockResolvedValue({ restored: [], conflicts: ["tracked.txt"] });
    expect(await rollbackCommand(options, {
      ...io(), ...fixture, confirmation: { ask: async () => cause !== "declined" }, busy: async () => cause === "busy",
    })).toBe(1);
    if (cause !== "conflict") expect(fixture.restore).not.toHaveBeenCalled();
  });

  it("uses real recovery eligibility to refuse an empty journal", async () => {
    const fixture = await rollbackFixture();
    expect(await rollbackCommand(options, {
      ...io(), source: fixture.source,
      open: WorkbenchRecoveryService.open, confirmation: { ask: async () => true }, busy: async () => false
    })).toBe(1);
  });
  it("does not restore when the recovery journal is incompatible", async () => {
    const fixture = await rollbackFixture();
    fixture.open.mockRejectedValue(new Error("incompatible journal"));
    const output = io();
    expect(await rollbackCommand(options, {
      ...output, ...fixture, confirmation: { ask: async () => true }, busy: async () => false,
    })).toBe(2);
    expect(fixture.details).not.toHaveBeenCalled();
    expect(await readFile(path.join(fixture.root, ".openspec-ui", "workspace.lease.json")).catch(() => undefined)).toBeUndefined();
  });

  it("refuses rollback while a real live status record names the target worktree", async () => {
    const root = await mkdtemp(path.join(os.tmpdir(), "cli-rollback-live-"));
    roots.push(root);
    const statusDirectory = path.join(root, ".agent-status");
    const writer = new AgentStatusWriter({ directory: statusDirectory, workingDirectory: root,
      changeName: "demo", instanceId: "live-writer", machine: "fixture" });
    await writer.start("running a delegated task");
    try {
      const output = io();
      const ask = vi.fn(async () => true);
      const open = vi.fn();
      expect(await rollbackCommand({ ...options, workspaceRoot: root }, {
        ...output, confirmation: { ask }, open,
        source: vi.fn().mockResolvedValue({ ok: true, path: root }),
        busy: async (_options, targetRoot) => {
          const { reports } = await readAgentStatuses(statusDirectory);
          return reports.some((report) => !report.gone && path.resolve(report.workingDirectory) === path.resolve(targetRoot));
        },
      })).toBe(1);
      expect(output.stderr.mock.calls[0]![0]).toContain("live writer");
      expect(ask).not.toHaveBeenCalled();
      expect(open).not.toHaveBeenCalled();
    } finally {
      await writer.stop();
    }
  });

  it.each(["recorded", "still-open", "reverted"])("honors the core delegated evidence result %s", async (gate) => {
    const output = io();
    const run = vi.fn().mockResolvedValue({ status: "ran", runId: "r1", agent: "copilot-cli", outcome: "completed", gate: { kind: gate }, message: "result", reply: {} });
    expect(await runTaskCommand({ ...options, number: "1.2" }, {
      ...output, permission: {}, run,
      find: vi.fn().mockResolvedValue({ ok: true, item: { text: "1.2 Verify", done: false, lineNumber: 7, delegatedTo: "copilot-cli" } }),
    })).toBe(gate === "recorded" ? 0 : 1);
    expect(run).toHaveBeenCalledOnce();
    expect(run.mock.calls[0]![0]).toMatchObject({ repositoryRoot: "/repo", changeName: "demo", lineNumber: 7, holdMutationLease: true });
    expect(JSON.parse(output.stdout.mock.calls[0]![0])).toMatchObject({ kind: "taskResult", runId: "r1" });
  });

  it.each([[true, "allow", 0], [false, "deny", 1]] as const)(
    "answers an agent permission request with %s and preserves the result code",
    async (allowed, permissionOutcome, expectedCode) => {
      const output = io();
      const commands: Command[] = [];
      const runner: AgentRunner = {
        async *run(command) {
          commands.push(command);
          if (command.kind === "implement") {
            yield {
              kind: "permissionRequest", runId: command.runId, timestamp: "2026-10-11T00:00:00Z",
              requestId: "permission-1", description: "Write the requested file"
            };
          } else if (command.kind === "resolvePermission") {
            yield {
              kind: "permissionSettled", runId: command.runId, timestamp: "2026-10-11T00:00:01Z",
              requestId: command.permissionRequestId!, outcome: command.permissionOutcome!
            };
          }
        }
      };
      const permission = { ask: vi.fn().mockResolvedValue(allowed) };
      const buildRunners = vi.fn(() => new Map([["copilot-cli", runner]]));
      const run = vi.fn(async (runOptions: Parameters<typeof runOwnDelegatedItem>[0]) => {
        const selected = runOptions.runnersFor("/repo")("copilot-cli");
        expect(selected).toBeDefined();
        const command: Command = {
          kind: "implement", cwd: "/repo", runId: "r1", agentId: "copilot-cli",
          taskNumber: "1.2", context: { changeDir: "/repo/openspec/changes/demo" }
        };
        for await (const event of selected!.run(command)) runOptions.onEvent?.(event);
        return {
          status: "ran" as const, runId: "r1", agent: "copilot-cli",
          outcome: allowed ? "completed" as const : "failed" as const,
          gate: { kind: "recorded" as const }, message: "permission handled",
          reply: { at: "2026-10-11T00:00:02Z", body: "permission handled", outcome: allowed ? "closed" as const : "failed" as const }
        };
      });
      expect(await runTaskCommand({ ...options, number: "1.2" }, {
        ...output, permission, run, buildRunners, find: vi.fn().mockResolvedValue({
          ok: true,
          item: { text: "1.2 **Delegated to copilot-cli**: check", done: false, lineNumber: 4, delegatedTo: "copilot-cli" }
        }),
      })).toBe(expectedCode);
      expect(permission.ask).toHaveBeenCalledWith("The agent asks: Write the requested file. Allow?");
      expect(commands.map((command) => command.kind)).toEqual(["implement", "resolvePermission"]);
      expect(commands[1]).toMatchObject({ kind: "resolvePermission", permissionRequestId: "permission-1", permissionOutcome });
    },
  );

  it("cancels the active delegated runner on SIGINT and exits unsuccessfully", async () => {
    const output = io();
    let cancelSeen = false;
    const runner: AgentRunner = {
      async *run(command) {
        if (command.kind === "cancel") {
          cancelSeen = true;
          yield { kind: "cancelled", runId: command.runId, timestamp: "2026-10-11T00:00:02Z", reason: "interrupted" };
        } else if (command.kind === "implement") {
          yield { kind: "started", runId: command.runId, timestamp: "2026-10-11T00:00:00Z", command: "implement", cwd: command.cwd };
          process.emit("SIGINT");
          yield { kind: "cancelled", runId: command.runId, timestamp: "2026-10-11T00:00:01Z", reason: "interrupted" };
        }
      }
    };
    const buildRunners = vi.fn(() => new Map([["copilot-cli", runner]]));
    const run = vi.fn(async (runOptions: Parameters<typeof runOwnDelegatedItem>[0]) => {
      const selected = runOptions.runnersFor("/repo")("copilot-cli");
      const command: Command = {
        kind: "implement", cwd: "/repo", runId: "r2", agentId: "copilot-cli",
        taskNumber: "1.2", context: { changeDir: "/repo/openspec/changes/demo" }
      };
      for await (const event of selected!.run(command)) runOptions.onEvent?.(event);
      return {
        status: "ran" as const, runId: "r2", agent: "copilot-cli", outcome: "cancelled" as const,
        gate: { kind: "still-open" as const }, message: "interrupted",
        reply: { at: "2026-10-11T00:00:02Z", body: "interrupted", outcome: "left-open" as const }
      };
    });
    expect(await runTaskCommand({ ...options, number: "1.2" }, {
      ...output, permission: {}, run, buildRunners, find: vi.fn().mockResolvedValue({
        ok: true,
        item: { text: "1.2 **Delegated to copilot-cli**: check", done: false, lineNumber: 4, delegatedTo: "copilot-cli" }
      }),
    })).toBe(1);
    expect(cancelSeen).toBe(true);
  });

  it("returns exit code 1 when the delegated runner fails", async () => {
    const output = io();
    const run = vi.fn().mockResolvedValue({
      status: "ran", runId: "failed-run", agent: "copilot-cli",
      outcome: "failed", gate: { kind: "still-open" }, message: "runner failed",
      reply: { at: "2026-10-11T00:00:02Z", body: "runner failed", outcome: "failed" }
    });
    expect(await runTaskCommand({ ...options, number: "1.2" }, {
      ...output, permission: {}, run,
      find: vi.fn().mockResolvedValue({
        ok: true,
        item: { text: "1.2 **Delegated to copilot-cli**: check", done: false, lineNumber: 4, delegatedTo: "copilot-cli" }
      }),
    })).toBe(1);
    expect(JSON.parse(output.stdout.mock.calls[0]![0])).toMatchObject({ kind: "taskResult", outcome: "failed" });
  });
});