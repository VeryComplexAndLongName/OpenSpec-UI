import { mkdtemp, readFile, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";
import { answerQuestion, appendQuestion, openQuestions, questionId, readQuestions } from "./decisions-file.js";

// every-varying-check-has-a-budget: a few small file writes.
vi.setConfig({ testTimeout: 15_000 });

const roots: string[] = [];
afterEach(async () => {
  await Promise.all(roots.splice(0).map((root) => rm(root, { recursive: true, force: true })));
});

async function changeDir(): Promise<string> {
  const root = await mkdtemp(path.join(os.tmpdir(), "openspec-decisions-"));
  roots.push(root);
  return path.join(root, "openspec", "changes", "demo");
}

const asked = (id: string, text: string, runId: string) => ({
  id, text, runId, askedAt: "2026-10-07T20:00:00.000Z", agent: "copilot-cli-acp", stage: "review",
});

// the-agent-asks-the-operator 1.4.
describe("decisions.md", () => {
  it("holds two runs' questions, answers one, and refuses a second answer", async () => {
    const dir = await changeDir();
    const first = questionId("run-aaaa-1111", 1);
    const second = questionId("run-bbbb-2222", 1);
    await appendQuestion(dir, asked(first, "Keep the v1 API?\n(yes/no)", "run-aaaa-1111"));
    await appendQuestion(dir, asked(second, "Which database?", "run-bbbb-2222"));

    expect((await openQuestions(dir)).map((question) => question.text)).toEqual(["Keep the v1 API? (yes/no)", "Which database?"]);

    expect(await answerQuestion(dir, first, { text: "Yes, keep it", by: "Alexander", at: "2026-10-07T20:05:00.000Z" })).toBe("answered");
    expect(await answerQuestion(dir, first, { text: "No", by: "Someone else", at: "2026-10-07T20:06:00.000Z" })).toBe("already-answered");
    expect(await answerQuestion(dir, "Q-nothing-9", { text: "?", by: "x", at: "y" })).toBe("not-found");

    const all = await readQuestions(dir);
    expect(all[0]).toMatchObject({ id: first, answer: "Yes, keep it", answeredBy: "Alexander", runId: "run-aaaa-1111", stage: "review", agent: "copilot-cli-acp" });
    expect((await openQuestions(dir)).map((question) => question.id)).toEqual([second]);

    const text = await readFile(path.join(dir, "decisions.md"), "utf8");
    expect(text.startsWith("# Decisions")).toBe(true);
    expect(text).toContain(`## ${second}: Which database?\n\n- Asked: 2026-10-07T20:00:00.000Z by copilot-cli-acp, stage review, run run-bbbb-2222\n- Answer: (open)`);
  });

  it("holds no question where there is no file", async () => {
    expect(await readQuestions(await changeDir())).toEqual([]);
  });

  it("reads an answer a person wrote into the file by hand", async () => {
    const dir = await changeDir();
    const id = questionId("run-cccc", 1);
    await appendQuestion(dir, asked(id, "Which database?", "run-cccc"));
    const file = path.join(dir, "decisions.md");
    const { writeFile } = await import("node:fs/promises");
    await writeFile(file, (await readFile(file, "utf8")).replace("- Answer: (open)", "- Answer: PostgreSQL"), "utf8");

    expect(await openQuestions(dir)).toEqual([]);
    expect((await readQuestions(dir))[0]?.answer).toBe("PostgreSQL");
  });
});
