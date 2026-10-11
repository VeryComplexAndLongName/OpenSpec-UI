import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";
import { AGENT_REGISTRY, HARNESS_AGENT_CAPABILITIES, MESSAGES, createFileRunLogs } from "@openspec-ui/core";
import { showAgentsCommand } from "./agents-command.js";
import { explainMessageCommand } from "./message-command.js";
import { readChangesReport, showChangesCommand } from "./changes-command.js";
import { reportCommand, ReportRefusal } from "./report-command.js";
import { readCostReport } from "./cost-command.js";
import { readRunReport } from "./show-run-command.js";
import { readHarnessReport } from "./harness-command.js";
import { showTasksCommand } from "./task-command.js";
import { readDiffReport, showDiffCommand } from "./diff-command.js";
import { explainChangeCommand, readExplanation } from "./explain-change-command.js";

vi.setConfig({ testTimeout: 60_000 });

const roots: string[] = [];
afterEach(async () => { await Promise.all(roots.splice(0).map((root) => rm(root, { recursive: true, force: true }))); });

async function fixture() {
  const root = await mkdtemp(path.join(os.tmpdir(), "cli-reports-"));
  roots.push(root);
  const changeDir = path.join(root, "openspec", "changes", "demo");
  await mkdir(changeDir, { recursive: true });
  await mkdir(path.join(root, ".openspec-ui"));
  await writeFile(path.join(changeDir, "tasks.md"), "## Work\n- [ ] 1.1 **Human-only.** Inspect\n  Evidence required\n- [x] 1.2 Completed\n");
  return { root, changeDir, options: { workspaceRoot: root, changeName: "demo", format: "json" as const } };
}

const options = { workspaceRoot: "/repo", format: "json" as const };
const io = () => ({ stdout: vi.fn(), stderr: vi.fn() });

describe("report commands", () => {
  it("lists every registered provider without claiming login", async () => {
    const output = io();
    expect(await showAgentsCommand(options, output)).toBe(0);
    const rows = JSON.parse(output.stdout.mock.calls[0]![0]);
    expect(rows.map((row: { id: string }) => row.id)).toEqual(AGENT_REGISTRY.map((agent) => agent.id));
    expect(rows.every((row: { provider: string; authentication: string }) => row.provider && row.authentication === "not checked")).toBe(true);
    expect(rows.map((row: { id: string; capabilities: unknown }) => [row.id, row.capabilities]))
      .toEqual(AGENT_REGISTRY.map((agent) => [agent.id, HARNESS_AGENT_CAPABILITIES[agent.id]]));
    expect(rows.find((row: { id: string }) => row.id === "local-llm")?.capabilities.editsFiles).toBe(false);
    expect(rows.find((row: { id: string }) => row.id === "codex-cli-acp")?.capabilities.effort).toBeUndefined();
  });
  it("explains a known message with template and remedy", async () => {
    const output = io();
    expect(await explainMessageCommand({ ...options, changeName: "OSW-CLI-001" }, output)).toBe(0);
    expect(JSON.parse(output.stdout.mock.calls[0]![0])).toMatchObject({ code: "OSW-CLI-001", level: "error" });
  });
  it("refuses unknown messages with clean stdout", async () => {
    const output = io();
    expect(await explainMessageCommand({ ...options, changeName: "OSW-NO-SUCH" }, output)).toBe(2);
    expect(output.stdout).not.toHaveBeenCalled();
    expect(output.stderr.mock.calls[0]![0]).toContain("OSW-CLI-018");
  });
  it("reports an empty active list successfully", async () => {
    const output = io();
    expect(await showChangesCommand(options, output, vi.fn().mockResolvedValue([]))).toBe(0);
    expect(JSON.parse(output.stdout.mock.calls[0]![0])).toEqual([]);
  });
  it("keeps stage, task totals, blockers and source in change reports", async () => {
    const report = {
      changeName: "demo", stage: "apply", path: "/repo/.worktrees/demo",
      tasks: { total: 3, done: 1 }, readiness: { blockers: ["foundation"] },
    };
    const json = io();
    expect(await showChangesCommand(options, json, vi.fn().mockResolvedValue([report]))).toBe(0);
    expect(JSON.parse(json.stdout.mock.calls[0]![0])[0]).toMatchObject(report);

    const text = io();
    expect(await showChangesCommand({ ...options, format: "text" }, text, vi.fn().mockResolvedValue([report]))).toBe(0);
    expect(text.stdout.mock.calls[0]![0]).toContain("demo apply 1/3 tasks /repo/.worktrees/demo blocked by foundation");
  });
  it("lists a real active change from its own worktree with task totals", async () => {
    const root = await mkdtemp(path.join(os.tmpdir(), "cli-change-repo-"));
    roots.push(root);
    const worktreeContainer = await mkdtemp(path.join(os.tmpdir(), "cli-change-worktrees-"));
    roots.push(worktreeContainer);
    const worktree = path.join(worktreeContainer, path.basename(root), "demo");
    const git = async (...args: string[]) => promisify(execFile)("git", ["-c", "core.hooksPath=", "-c", "commit.gpgsign=false", ...args], { cwd: root });
    await mkdir(path.join(root, "openspec", "changes", "demo"), { recursive: true });
    await writeFile(path.join(root, "openspec", "changes", "demo", "proposal.md"), "# Demo\n");
    await writeFile(path.join(root, "openspec", "changes", "demo", "tasks.md"), "- [ ] 1.1 First\n- [x] 1.2 Second\n");
    await git("init", "-q");
    await git("config", "user.name", "Fixture");
    await git("config", "user.email", "fixture@example.com");
    await git("add", ".");
    await git("commit", "-q", "-m", "fixture");
    await mkdir(path.dirname(worktree), { recursive: true });
    await git("worktree", "add", "-b", "demo", worktree, "HEAD");

    const previousRoot = process.env.OPENSPEC_UI_WORKTREE_ROOT;
    process.env.OPENSPEC_UI_WORKTREE_ROOT = worktreeContainer;
    try {
      const rows = await readChangesReport({ workspaceRoot: root, format: "json" });
      expect(rows).toHaveLength(1);
      expect(rows[0]).toMatchObject({ changeName: "demo", tasks: { total: 2, done: 1 } });
      expect(path.resolve(rows[0]!.path!)).toBe(path.resolve(worktree));
    } finally {
      if (previousRoot === undefined) delete process.env.OPENSPEC_UI_WORKTREE_ROOT;
      else process.env.OPENSPEC_UI_WORKTREE_ROOT = previousRoot;
    }
  });
  it("distinguishes core refusal from reader failure", async () => {
    expect(await reportCommand("show run", options, io(), async () => { throw new ReportRefusal("missing"); }, String)).toBe(1);
    expect(await reportCommand("show run", options, io(), async () => { throw new Error("reader failed"); }, String)).toBe(2);
  });

  it("reads actual task responsibility and evidence from checkout fallback", async () => {
    const { root } = await fixture();
    const output = io();
    expect(await showTasksCommand({ repositoryRoot: root, changeName: "demo", format: "json" }, output)).toBe(0);
    const result = JSON.parse(output.stdout.mock.calls[0]![0]);
    expect(result.source).toBe("this-checkout");
    expect(result.rows[0]).toMatchObject({ number: "1.1", closedBy: "person", body: "Evidence required", done: false });
  });
  it("preserves delegated task ownership from the change's own worktree", async () => {
    const output = io();
    const row = {
      number: "2.3", section: "Verify", text: "Run the check", lineNumber: 8,
      body: "Record evidence", done: false, closedBy: "named-agent", agent: "copilot-cli"
    } as const;
    const read = vi.fn().mockResolvedValue({
      ok: true, changeName: "demo", source: "own-worktree",
      path: "/repo/.worktrees/demo", tasksPath: "/repo/.worktrees/demo/openspec/changes/demo/tasks.md", rows: [row]
    });
    expect(await showTasksCommand({ repositoryRoot: "/repo", changeName: "demo", format: "json" }, { ...output, read })).toBe(0);
    expect(JSON.parse(output.stdout.mock.calls[0]![0])).toMatchObject({ source: "own-worktree", rows: [row] });
  });
  it("refuses a task list the core cannot resolve instead of returning an empty report", async () => {
    const output = io();
    const read = vi.fn().mockResolvedValue({ ok: false, kind: "no-task-list", reason: "demo has no tasks.md here or in a worktree of its own." });
    expect(await showTasksCommand({ repositoryRoot: "/repo", changeName: "demo", format: "json" }, { ...output, read })).toBe(1);
    expect(output.stdout).not.toHaveBeenCalled();
    expect(output.stderr.mock.calls[0]![0]).toContain("OSW-CLI-017");
  });

  it("uses the owning change's harness override", async () => {
    const { root, changeDir, options: config } = await fixture();
    await writeFile(path.join(root, "openspec", "agent-harness.json"), JSON.stringify({ budget: { maxCostUsd: 10 } }));
    await writeFile(path.join(changeDir, "harness.json"), JSON.stringify({
      autonomyLevel: "semi-autonomous",
      stepAgents: { apply: { agent: "copilot-cli", budget: { maxAiCredits: 30 } } },
    }));
    const report = await readHarnessReport(config);
    expect(report.path).toBe(root);
    expect(report.config).toMatchObject({
      autonomyLevel: "semi-autonomous", budget: { maxCostUsd: 10 },
      stepAgents: { apply: { agent: "copilot-cli", budget: { maxAiCredits: 30 } } },
    });
    expect(report.capabilities["copilot-cli"]?.budgetField).toBe("maxAiCredits");
  });

  it("refuses the host-only VS Code Chat target for a delegated terminal task", async () => {
    const { changeDir, options: config } = await fixture();
    await writeFile(path.join(changeDir, "harness.json"), JSON.stringify({ taskAgents: { "1.1": "vscode-chat" } }));
    await expect(readHarnessReport(config)).rejects.toThrow(/cannot run one task/);
  });

  it("returns a registered message template with its placeholders intact", async () => {
    const [code, entry] = Object.entries(MESSAGES).find(([, message]) => /\{[^}]+\}/.test(message.text))!;
    const output = io();
    expect(await explainMessageCommand({ ...options, changeName: code }, output)).toBe(0);
    expect(JSON.parse(output.stdout.mock.calls[0]![0])).toMatchObject({ code, text: entry.text, why: entry.why, todo: entry.todo });
  });

  it("reports an empty and truncated artifact diff without inventing changes", async () => {
    const output = io();
    const result = { scope: "OpenSpec artifacts against HEAD", path: "/repo", diff: "", files: [], truncated: true, maxBytes: 64 };
    expect(await showDiffCommand({ ...options, changeName: "demo", format: "text" }, output, vi.fn().mockResolvedValue(result))).toBe(0);
    expect(output.stdout.mock.calls[0]![0]).toContain("OpenSpec artifacts against HEAD (/repo)");
    expect(output.stdout.mock.calls[0]![0]).toContain("No artifact changes.");
    expect(output.stdout.mock.calls[0]![0]).toContain("Diff truncated.");
  });

  it("reads actual explanation roles and task progress without changing files", async () => {
    const { root, changeDir, options: config } = await fixture();
    const tasksPath = path.join(changeDir, "tasks.md");
    const before = await readFile(tasksPath, "utf8");
    const report = await readExplanation(config);
    expect(report.changeName).toBe("demo");
    expect(path.resolve(report.path)).toBe(path.resolve(root));
    expect(report.history.roles).toEqual({});
    expect(report.tasks.map((row) => [row.number, row.done])).toEqual([["1.1", false], ["1.2", true]]);
    expect(report.questions).toEqual([]);
    expect(Array.isArray(report.advice)).toBe(true);
    expect(await readFile(tasksPath, "utf8")).toBe(before);
  });

  it("returns explanation facts and next actions as parseable JSON", async () => {
    const output = io();
    const report = {
      changeName: "demo", path: "/repo/.worktrees/demo", stage: "apply",
      owner: "Ada", implementer: "copilot-cli", progress: { total: 3, done: 1 },
      tasks: [{ number: "1.2", done: false, closedBy: "named-agent", agent: "copilot-cli" }],
      questions: [{ id: "q1", question: "Which target?" }],
      readiness: { blockers: ["base change"] }, advice: ["Answer q1 before apply"]
    };
    expect(await explainChangeCommand({ ...options, changeName: "demo" }, output, vi.fn().mockResolvedValue(report))).toBe(0);
    expect(JSON.parse(output.stdout.mock.calls[0]![0])).toMatchObject(report);
  });

  it("uses core aggregation to count a measured run once and retain credit units", async () => {
    const { root, changeDir, options: config } = await fixture();
    const base = { agent: "claude-cli", cwd: root, timestamp: "2026-10-10T00:00:00Z", changeDir };
    const entries = [
      { ...base, runId: "measured", outcome: "started" },
      { ...base, runId: "measured", outcome: "completed", usage: { costUsd: 2, cost: { amount: 4, currency: "credits" } } },
      { ...base, runId: "unmeasured", outcome: "completed" },
      { ...base, changeDir: path.join(root, "other"), runId: "other", outcome: "completed", usage: { costUsd: 100 } },
    ];
    await writeFile(path.join(root, ".openspec-ui", "audit.jsonl"), entries.map((entry) => JSON.stringify(entry)).join("\n"));
    const result = await readCostReport(config);
    expect(result.recordedRunCount).toBe(2);
    expect(result.unmeasuredRunCount).toBe(1);
    expect(result.totalsByAgent["claude-cli"]).toMatchObject({ runCount: 1, costUsd: 2, costByUnit: { credits: 4 } });
  });

  it("aggregates recorded change spend from a real sibling worktree", async () => {
    const { root, changeDir, options: config } = await fixture();
    const worktreeParent = await mkdtemp(path.join(os.tmpdir(), "cli-cost-worktree-"));
    roots.push(worktreeParent);
    const worktree = path.join(worktreeParent, "demo");
    const git = async (...args: string[]) => promisify(execFile)("git", ["-c", "core.hooksPath=", "-c", "commit.gpgsign=false", ...args], { cwd: root });
    await git("init", "-q");
    await git("config", "user.name", "Fixture");
    await git("config", "user.email", "fixture@example.com");
    await git("add", "openspec/changes/demo/tasks.md");
    await git("commit", "-q", "-m", "fixture");
    await git("worktree", "add", "--detach", worktree, "HEAD");

    const rootEntry = {
      agent: "claude-cli", runId: "root-run", outcome: "completed",
      cwd: root, timestamp: "2026-10-10T00:00:00Z", changeDir, usage: { costUsd: 1 }
    };
    const worktreeEntry = {
      agent: "claude-cli", runId: "worktree-run", outcome: "completed",
      cwd: worktree, timestamp: "2026-10-10T00:01:00Z",
      changeDir: path.join(worktree, "openspec", "changes", "demo"), usage: { costUsd: 2 }
    };
    await mkdir(path.join(worktree, ".openspec-ui"), { recursive: true });
    await writeFile(path.join(root, ".openspec-ui", "audit.jsonl"), `${JSON.stringify(rootEntry)}\n`);
    await writeFile(path.join(worktree, ".openspec-ui", "audit.jsonl"), `${JSON.stringify(worktreeEntry)}\n`);

    const result = await readCostReport(config);
    expect(result.recordedRunCount).toBe(2);
    expect(result.totalsByAgent["claude-cli"]).toMatchObject({ runCount: 2, costUsd: 3 });
  });

  it("reports zero recorded runs without inventing free usage", async () => {
    const { options: config } = await fixture();
    expect(await readCostReport(config)).toMatchObject({ recordedRunCount: 0, unmeasuredRunCount: 0, totalsByAgent: {} });
  });

  it("reads retained run output and records pruned-output absence", async () => {
    const { root, options: config } = await fixture();
    const logs = createFileRunLogs(root);
    const log = logs.open({ runId: "run-1", agent: "claude-cli", changeName: "demo", kind: "implement", cwd: root });
    log.event({ kind: "stdout", runId: "run-1", timestamp: "2026-10-10T00:00:00Z", chunk: "retained text" });
    await log.end({ outcome: "completed" });
    const result = await readRunReport({ ...config, changeName: "run-1" });
    expect(result.outputMissing).toBe(false);
    expect(JSON.stringify(result.logs)).toContain("retained text");
    await writeFile(path.join(root, ".openspec-ui", "audit.jsonl"), JSON.stringify({ runId: "pruned", outcome: "completed" }));
    expect(await readRunReport({ ...config, changeName: "pruned" })).toMatchObject({ outputMissing: true });
    await expect(readRunReport({ ...config, changeName: "unknown-instance" })).rejects.toBeInstanceOf(ReportRefusal);
  });
  it("returns records only for the requested run id", async () => {
    const { root, changeDir, options: config } = await fixture();
    const logs = createFileRunLogs(root);
    for (const runId of ["wanted-run", "other-run"]) {
      const log = logs.open({ runId, agent: "claude-cli", changeName: "demo", kind: "implement", cwd: root });
      log.event({ kind: "stdout", runId, timestamp: "2026-10-10T00:00:00Z", chunk: runId });
      await log.end({ outcome: "completed" });
    }
    const audit = ["wanted-run", "other-run"].map((runId) => JSON.stringify({
      runId, agent: "claude-cli",
      outcome: "completed", cwd: root, timestamp: "2026-10-10T00:00:00Z", changeDir
    }));
    await writeFile(path.join(root, ".openspec-ui", "audit.jsonl"), `${audit.join("\n")}\n`);
    const report = await readRunReport({ ...config, changeName: "wanted-run" });
    expect(report.entries.map((entry) => entry.runId)).toEqual(["wanted-run"]);
    expect(JSON.stringify(report.logs)).toContain("wanted-run");
    expect(JSON.stringify(report.logs)).not.toContain("other-run");
  });

  it("resolves defaults and refuses invalid change configuration", async () => {
    const { changeDir, options: config } = await fixture();
    expect((await readHarnessReport(config)).config.autonomyLevel).toBe("assisted");
    await writeFile(path.join(changeDir, "harness.json"), JSON.stringify({ autonomyLevel: "invalid" }));
    await expect(readHarnessReport(config)).rejects.toThrow();
  });

  it("includes staged and untracked artifacts but excludes implementation files", async () => {
    const { root, changeDir, options: config } = await fixture();
    const git = async (...args: string[]) => promisify(execFile)("git", ["-c", "core.hooksPath=", "-c", "commit.gpgsign=false", ...args], { cwd: root });
    await git("init", "-q");
    await git("config", "user.name", "Fixture");
    await git("config", "user.email", "fixture@example.com");
    await git("add", ".");
    await git("commit", "-q", "-m", "fixture");
    await writeFile(path.join(changeDir, "tasks.md"), "- [x] 1.1 Changed\n");
    await git("add", "openspec/changes/demo/tasks.md");
    await writeFile(path.join(changeDir, "tasks.md"), "- [x] 1.1 Changed\n- [ ] 1.2 Unstaged artifact\n");
    await writeFile(path.join(changeDir, "proposal.md"), "# New artifact\n");
    await writeFile(path.join(root, "implementation.ts"), "not an artifact");
    const result = await readDiffReport(config);
    expect(result.scope).toBe("OpenSpec artifacts against HEAD");
    expect(result.diff).toContain("Changed");
    expect(result.diff).toContain("Unstaged artifact");
    expect(result.diff).toContain("New artifact");
    expect(result.files).not.toContain("implementation.ts");
  });
});