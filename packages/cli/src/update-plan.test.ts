import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";
import { DEFAULT_AGENT_ID, type AgentRunner, type Command, type Event } from "@openspec-ui/core";
import { updatePlan, type UpdatePlanDeps } from "./update-plan.js";

// the-plan-is-updated-from-its-review 3.x: no agent is spawned — the runner
// is a scripted generator — so each test is a few file writes.
vi.setConfig({ testTimeout: 15_000 });

const temporaryRoots: string[] = [];

async function temporaryRoot(): Promise<string> {
  const root = await mkdtemp(path.join(os.tmpdir(), "openspec-cli-update-"));
  temporaryRoots.push(root);
  return root;
}

afterEach(async () => {
  await Promise.all(temporaryRoots.splice(0).map((root) => rm(root, { recursive: true, force: true })));
});

async function makeChange(root: string, changeName: string, harness?: Record<string, unknown>): Promise<void> {
  const changeDir = path.join(root, "openspec", "changes", changeName);
  await mkdir(changeDir, { recursive: true });
  await writeFile(path.join(changeDir, "proposal.md"), "# A change\n\n## Why\n\nBecause.\n", "utf8");
  if (harness) await writeFile(path.join(changeDir, "harness.json"), JSON.stringify(harness), "utf8");
}

const at = "2026-10-07T00:00:00.000Z";

function scriptedRunner(events: Array<Omit<Event, "runId">>) {
  const commands: Command[] = [];
  const runner = {
    async *run(command: Command) {
      commands.push(command);
      for (const event of events) yield { ...event, runId: command.runId } as Event;
    },
    cancel: () => true,
  } as unknown as AgentRunner;
  return { commands, runner };
}

function deps(runners: Map<string, AgentRunner>) {
  const out: string[] = [];
  const err: string[] = [];
  const value: UpdatePlanDeps = {
    stdout: (text) => out.push(text),
    stderr: (line) => err.push(line),
    createRunners: () => runners,
  };
  return { out, err, value };
}

describe("updatePlan", () => {
  it("runs the update with the notes and exits 0 when it completes", async () => {
    const root = await temporaryRoot();
    await makeChange(root, "a-change");
    const scripted = scriptedRunner([{ kind: "completed", timestamp: at, summary: "updated the design" } as Omit<Event, "runId">]);
    const io = deps(new Map([[DEFAULT_AGENT_ID, scripted.runner]]));

    const code = await updatePlan({ workspaceRoot: root, changeName: "a-change", note: "  keep the API  ", format: "text" }, io.value);

    expect(code).toBe(0);
    expect(scripted.commands).toHaveLength(1);
    expect(scripted.commands[0]?.kind).toBe("update");
    expect(scripted.commands[0]?.context).toMatchObject({ changeDir: path.join(root, "openspec", "changes", "a-change"), notes: "keep the API" });
    expect(io.out.join("")).toContain("updated the design");
  });

  it("exits 1 when the update fails", async () => {
    const root = await temporaryRoot();
    await makeChange(root, "a-change");
    const scripted = scriptedRunner([{ kind: "failed", timestamp: at, reason: "validate failed" } as Omit<Event, "runId">]);
    const io = deps(new Map([[DEFAULT_AGENT_ID, scripted.runner]]));

    expect(await updatePlan({ workspaceRoot: root, changeName: "a-change", format: "text" }, io.value)).toBe(1);
    expect(scripted.commands[0]?.context).not.toHaveProperty("notes");
  });

  it("exits 2 for a change that is not there, or an agent that is not known", async () => {
    const root = await temporaryRoot();
    await makeChange(root, "a-change");
    const scripted = scriptedRunner([]);
    const io = deps(new Map([[DEFAULT_AGENT_ID, scripted.runner]]));

    expect(await updatePlan({ workspaceRoot: root, changeName: "missing", format: "text" }, io.value)).toBe(2);
    expect(await updatePlan({ workspaceRoot: root, changeName: "a-change", agent: "nobody", format: "text" }, io.value)).toBe(2);
    expect(io.err.join("\n")).toContain("is not an active change");
    expect(io.err.join("\n")).toContain('no agent "nobody"');
    expect(scripted.commands).toHaveLength(0);
  });

  // Live run 4.3: an ACP agent's request, unanswered, held the update for
  // ever.
  it("puts an agent's permission request to the terminal, and denies it where nobody can be asked", async () => {
    for (const [ask, expected] of [[() => Promise.resolve(true), "allow"], [undefined, "deny"]] as const) {
      const root = await temporaryRoot();
      await makeChange(root, "a-change");
      const commands: Command[] = [];
      const runner = {
        async *run(command: Command) {
          commands.push(command);
          if (command.kind === "resolvePermission") return;
          yield { kind: "permissionRequest", runId: command.runId, timestamp: at, requestId: "req-1", description: "edit tasks.md" } as Event;
          yield { kind: "completed", runId: command.runId, timestamp: at, summary: "done" } as Event;
        },
      } as unknown as AgentRunner;
      const io = deps(new Map([[DEFAULT_AGENT_ID, runner]]));
      const asked: string[] = [];
      io.value.permission = ask === undefined ? {} : { ask: (question) => { asked.push(question); return ask(); } };

      expect(await updatePlan({ workspaceRoot: root, changeName: "a-change", format: "text" }, io.value)).toBe(0);
      expect(commands[1]).toMatchObject({ kind: "resolvePermission", permissionRequestId: "req-1", permissionOutcome: expected });
      if (ask === undefined) expect(io.err.join("\n")).toContain("nobody at this terminal to ask: edit tasks.md");
      else expect(asked).toEqual(["The agent asks: edit tasks.md. Allow?"]);
    }
  });

  it("prints one JSON line per event", async () => {
    const root = await temporaryRoot();
    await makeChange(root, "a-change");
    const scripted = scriptedRunner([{ kind: "completed", timestamp: at, summary: "done" } as Omit<Event, "runId">]);
    const io = deps(new Map([[DEFAULT_AGENT_ID, scripted.runner]]));

    expect(await updatePlan({ workspaceRoot: root, changeName: "a-change", format: "json" }, io.value)).toBe(0);
    const lines = io.out.join("").trim().split("\n").filter((line) => line.length > 0);
    expect(lines.some((line) => (JSON.parse(line) as { kind?: string }).kind === "completed")).toBe(true);
  });
});
