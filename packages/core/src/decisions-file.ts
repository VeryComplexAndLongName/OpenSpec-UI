// The change's decisions: the questions its agents put to the operator, and
// the answers (the-agent-asks-the-operator, ADR 0042).
//
// One file, `decisions.md` in the change's directory, and the one place a
// question is open or answered: a run that waits reads it, an answer from
// any host - the card, the AI panel, the Inbox, the CLI, a person editing
// the file - is written to it, and it is committed with the change, so the
// decisions travel with the plan they shaped. Entries are appended and
// answered in place; nothing else of the file is rewritten.

import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

export const DECISIONS_FILE = "decisions.md";

const OPEN = "(open)";
const HEADER = [
  "# Decisions",
  "",
  "Questions this change's agents put to the operator, and the answers. A run",
  "that asked waits until every question it asked is answered; answer by",
  "replacing `(open)` with the answer, or from OpenSpec Workbench.",
  "",
].join("\n");

export interface OperatorQuestion {
  id: string;
  text: string;
  askedAt: string;
  agent: string;
  stage: string;
  runId: string;
  answer?: string;
  answeredAt?: string;
  answeredBy?: string;
  /** Zero-based line of its heading, as read; absent on a question that
   * was not read from a file. */
  lineNumber?: number;
}

const ENTRY_RE = /^## (Q-[A-Za-z0-9-]+): (.*)$/u;
const ASKED_RE = /^- Asked: (\S+) by (.+), stage (\S+), run (\S+)$/u;
const ANSWER_RE = /^- Answer: (.*)$/u;
const ANSWERED_RE = /^- Answered: (\S+) by (.+)$/u;

async function readIfThere(file: string): Promise<string | undefined> {
  try {
    return await readFile(file, "utf8");
  } catch {
    return undefined;
  }
}

/** Every question the change's `decisions.md` holds, in order. A file that
 * is not there holds none. */
export async function readQuestions(changeDir: string): Promise<OperatorQuestion[]> {
  const text = await readIfThere(path.join(changeDir, DECISIONS_FILE));
  if (text === undefined) return [];
  const questions: OperatorQuestion[] = [];
  let current: OperatorQuestion | undefined;
  for (const [lineNumber, line] of text.split(/\r?\n/u).entries()) {
    const entry = ENTRY_RE.exec(line);
    if (entry !== null) {
      current = { id: entry[1]!, text: entry[2]!.trim(), askedAt: "", agent: "", stage: "", runId: "", lineNumber };
      questions.push(current);
      continue;
    }
    if (current === undefined) continue;
    const asked = ASKED_RE.exec(line);
    if (asked !== null) {
      current.askedAt = asked[1]!;
      current.agent = asked[2]!;
      current.stage = asked[3]!;
      current.runId = asked[4]!;
      continue;
    }
    const answer = ANSWER_RE.exec(line);
    if (answer !== null) {
      const value = answer[1]!.trim();
      if (value.length > 0 && value !== OPEN) current.answer = value;
      continue;
    }
    const answered = ANSWERED_RE.exec(line);
    if (answered !== null) {
      current.answeredAt = answered[1]!;
      current.answeredBy = answered[2]!.trim();
    }
  }
  return questions;
}

/** The questions not answered yet. */
export async function openQuestions(changeDir: string): Promise<OperatorQuestion[]> {
  return (await readQuestions(changeDir)).filter((question) => question.answer === undefined);
}

/** The id a run's n-th question gets: short, readable, and unique to the run. */
export function questionId(runId: string, n: number): string {
  return `Q-${runId.replace(/[^A-Za-z0-9]/gu, "").slice(0, 8)}-${n}`;
}

/** Appends a question to the change's `decisions.md`, making the file where
 * it is not there. The text is kept on one line. */
export async function appendQuestion(changeDir: string, question: Omit<OperatorQuestion, "answer" | "answeredAt" | "answeredBy">): Promise<void> {
  const file = path.join(changeDir, DECISIONS_FILE);
  const existing = await readIfThere(file);
  const text = question.text.replace(/\s+/gu, " ").trim();
  const entry = [
    `## ${question.id}: ${text}`,
    "",
    `- Asked: ${question.askedAt} by ${question.agent}, stage ${question.stage}, run ${question.runId}`,
    `- Answer: ${OPEN}`,
    "",
  ].join("\n");
  await mkdir(changeDir, { recursive: true });
  const before = existing ?? HEADER;
  const separator = before.endsWith("\n\n") ? "" : before.endsWith("\n") ? "\n" : "\n\n";
  await writeFile(file, `${before}${separator}${entry}`, "utf8");
}

export type AnswerOutcome = "answered" | "already-answered" | "not-found";

/** Records the answer to a question that is still open. The first answer
 * stands: a second is refused as `already-answered`, and nothing changes. */
export async function answerQuestion(
  changeDir: string,
  id: string,
  answer: { text: string; by: string; at: string },
): Promise<AnswerOutcome> {
  const file = path.join(changeDir, DECISIONS_FILE);
  const existing = await readIfThere(file);
  if (existing === undefined) return "not-found";
  const newline = existing.includes("\r\n") ? "\r\n" : "\n";
  const lines = existing.split(/\r?\n/u);
  const start = lines.findIndex((line) => ENTRY_RE.exec(line)?.[1] === id);
  if (start === -1) return "not-found";
  let end = lines.findIndex((line, index) => index > start && ENTRY_RE.test(line));
  if (end === -1) end = lines.length;
  const answerAt = lines.findIndex((line, index) => index > start && index < end && ANSWER_RE.test(line));
  if (answerAt === -1) return "not-found";
  if (ANSWER_RE.exec(lines[answerAt]!)![1]!.trim() !== OPEN) return "already-answered";
  const text = answer.text.replace(/\s+/gu, " ").trim();
  lines.splice(answerAt, 1, `- Answer: ${text}`, `- Answered: ${answer.at} by ${answer.by}`);
  await writeFile(file, lines.join(newline), "utf8");
  return "answered";
}
