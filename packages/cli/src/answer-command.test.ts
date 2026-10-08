import { mkdtemp, readFile, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";
import { appendQuestion } from "@openspec-ui/core";
import { answerCommand } from "./answer-command.js";

// every-varying-check-has-a-budget: a few small file writes, no process.
vi.setConfig({ testTimeout: 15_000 });

const roots: string[] = [];
afterEach(async () => {
  await Promise.all(roots.splice(0).map((root) => rm(root, { recursive: true, force: true })));
});

async function repository() {
  const parent = await mkdtemp(path.join(os.tmpdir(), "openspec-cli-answer-"));
  roots.push(parent);
  const root = path.join(parent, "shop");
  // The change is worked in its own directory, where the question is.
  const changeDir = path.join(parent, ".worktrees", "shop", "add-cart", "openspec", "changes", "add-cart");
  await appendQuestion(changeDir, { id: "Q-run1-1", text: "Which database?", askedAt: "2026-10-08T08:00:00.000Z", agent: "copilot-cli-acp", stage: "review", runId: "run1" });
  return { root, changeDir, rootSources: { env: {}, homeDirectory: path.join(parent, "no-home") } };
}

function io() {
  const out: string[] = [];
  const err: string[] = [];
  return { out, err, stdout: (line: string) => out.push(line), stderr: (line: string) => err.push(line) };
}

// the-agent-asks-the-operator 2.3.
describe("answerCommand", () => {
  it("lists the change's open questions, found in its own working directory", async () => {
    const { root, rootSources } = await repository();
    const lines = io();

    expect(await answerCommand({ repositoryRoot: root, changeName: "add-cart", format: "text" }, { ...lines, rootSources })).toBe(0);
    expect(lines.out.join("\n")).toContain("Q-run1-1  Which database?");
  });

  it("answers one, and refuses a second answer", async () => {
    const { root, changeDir, rootSources } = await repository();
    const first = io();
    const second = io();

    expect(await answerCommand({ repositoryRoot: root, changeName: "add-cart", questionId: "Q-run1-1", answer: "PostgreSQL", format: "text" }, { ...first, rootSources, readIdentity: async () => "Ada" })).toBe(0);
    expect(await answerCommand({ repositoryRoot: root, changeName: "add-cart", questionId: "Q-run1-1", answer: "MySQL", format: "text" }, { ...second, rootSources })).toBe(1);

    expect(await readFile(path.join(changeDir, "decisions.md"), "utf8")).toContain("- Answer: PostgreSQL");
    expect(second.err.join("\n")).toContain("was already answered");
  });

  it("refuses a change that is nowhere", async () => {
    const { root, rootSources } = await repository();
    const lines = io();

    expect(await answerCommand({ repositoryRoot: root, changeName: "missing", format: "text" }, { ...lines, rootSources })).toBe(2);
  });
});
