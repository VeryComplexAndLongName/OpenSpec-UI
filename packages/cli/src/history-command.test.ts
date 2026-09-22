import { describe, expect, it } from "vitest";
import { HistoryRefusedError, type ChangeHistory, type RecordedEvent } from "@openspec-ui/core";
import { historyCommand, parseReopen, recordCommand } from "./history-command.js";
import { runMain } from "./main.js";

// a-change-keeps-its-history: the CLI's words for a change's history.

function capture() {
  const out: string[] = [];
  const err: string[] = [];
  return { out, err, deps: { stdout: (line: string) => out.push(line), stderr: (line: string) => err.push(line) } };
}

const base = { version: 1 as const, change: "demo", at: "2026-09-22T10:00:00.000Z", by: { handle: "ada", keyId: "k" }, actor: { kind: "person" as const } };

describe("history", () => {
  it("says who holds the change and every event, marking one the rules refuse", async () => {
    const history: ChangeHistory = {
      changeName: "demo",
      roles: { owner: "ada" },
      entries: [
        { file: "1.json", signature: "verified", keyId: "k", handle: "ada", event: { ...base, type: "owner-set", to: "ada" } },
        { file: "2.json", signature: "verified", keyId: "k", handle: "bob", event: { ...base, at: "2026-09-22T11:00:00.000Z", by: { handle: "bob", keyId: "k" }, type: "owner-set", to: "bob" } },
      ],
      problems: [{ file: "2.json", problem: "only the Owner, ada, hands the ownership on" }],
    };
    const { out, deps } = capture();

    const code = await historyCommand({ workspaceRoot: "/repo", changeName: "demo", format: "text" }, { ...deps, read: async () => history });

    expect(code).toBe(1);
    expect(out).toEqual([
      "Owner: ada. Implementer: nobody.",
      "2026-09-22T10:00:00.000Z  ada made ada the Owner",
      "2026-09-22T11:00:00.000Z  bob made bob the Owner  [refused: only the Owner, ada, hands the ownership on]",
    ]);
  });
});

describe("recording", () => {
  it("says what it recorded and what to commit", async () => {
    const recorded: RecordedEvent = {
      file: "openspec/changes/demo/history/x.json",
      tasksFile: "openspec/changes/demo/tasks.md",
      event: { ...base, type: "sent-back", toStage: "in-progress", reason: "a gap", reopened: [{ task: "1.1", why: "no test" }] },
      roles: { owner: "ada" },
    };
    const { out, deps } = capture();

    const code = await recordCommand(
      { workspaceRoot: "/repo", changeName: "demo", request: { type: "sent-back", toStage: "in-progress", reason: "a gap" }, format: "text" },
      { ...deps, record: async () => recorded },
    );

    expect(code).toBe(0);
    expect(out).toEqual([
      "Recorded: ada sent it back to In progress, reopening 1.1: a gap.",
      "Owner: ada. Implementer: nobody.",
      "Commit openspec/changes/demo/history/x.json and openspec/changes/demo/tasks.md in the change's pull request.",
    ]);
  });

  it("exits 1 on a refusal", async () => {
    const { err, deps } = capture();

    expect(await recordCommand(
      { workspaceRoot: "/repo", changeName: "demo", request: { type: "owner-set", to: "bob" }, format: "text" },
      { ...deps, record: async () => { throw new HistoryRefusedError("only the Owner, ada, hands the ownership on"); } },
    )).toBe(1);
    expect(err).toEqual(["openspec-ui-cli: only the Owner, ada, hands the ownership on"]);
  });

  it("reads --reopen as a task and a reason", () => {
    expect(parseReopen(["2.3:the test is missing", "1.1: flaky "])).toEqual([{ task: "2.3", why: "the test is missing" }, { task: "1.1", why: "flaky" }]);
    expect(parseReopen(["2.3"])).toContain("--reopen takes <task>:<why>");
  });

  it("passes the command line through: the stage, the reason, the reopened items and the agent", async () => {
    let seen: unknown;
    const code = await runMain(
      ["send-back", "demo", "--stage", "planned", "--reason", "scope grew", "--reopen", "1.1:split it", "--agent", "codex-cli", "--cwd", "/repo"],
      { ...capture().deps, recordCommand: async (options) => { seen = options; return 0; } },
    );

    expect(code).toBe(0);
    expect(seen).toMatchObject({
      workspaceRoot: "/repo",
      changeName: "demo",
      request: { type: "sent-back", toStage: "planned", reason: "scope grew", reopened: [{ task: "1.1", why: "split it" }] },
      actor: { kind: "agent", agent: "codex-cli" },
    });
  });

  it("refuses a send-back to a stage a change cannot go back to", async () => {
    const { err, deps } = capture();

    expect(await runMain(["send-back", "demo", "--stage", "archived", "--reason", "x"], deps)).toBe(2);
    expect(err[0]).toContain("send-back requires --stage");
  });
});
