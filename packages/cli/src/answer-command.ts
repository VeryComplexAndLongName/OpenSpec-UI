// Answering an agent's question from a terminal (the-agent-asks-the-operator,
// ADR 0042).
//
// `answer <change>` lists the change's open questions; `answer <change>
// <Q-id> <answer>` answers one. The answer is written to the change's
// `decisions.md`, where a run waiting on it reads it - whichever host or
// terminal started that run. The change is looked for in this checkout, and
// in its own working directory, where a change is worked.

import { stat } from "node:fs/promises";
import path from "node:path";
import {
  answerQuestion,
  createGitWrapper,
  defaultWorktreePath,
  openQuestions,
  type WorktreeRootSources,
} from "@openspec-ui/core";

export interface AnswerOptions {
  repositoryRoot: string;
  changeName?: string;
  questionId?: string;
  answer?: string;
  format: "text" | "json";
}

export interface AnswerDeps {
  stdout: (line: string) => void;
  stderr: (line: string) => void;
  /** Test seams. */
  readIdentity?: (cwd: string) => Promise<string | undefined>;
  rootSources?: WorktreeRootSources;
  now?: () => Date;
}

async function isDirectory(directory: string): Promise<boolean> {
  return stat(directory).then((found) => found.isDirectory(), () => false);
}

/** Where the change is: its own working directory first, since a change is
 * worked there, then this checkout. */
async function changeDirectoryOf(repositoryRoot: string, changeName: string, rootSources?: WorktreeRootSources): Promise<string | undefined> {
  const own = path.join(await defaultWorktreePath(repositoryRoot, changeName, rootSources), "openspec", "changes", changeName);
  const here = path.join(repositoryRoot, "openspec", "changes", changeName);
  for (const candidate of [own, here]) {
    if (await isDirectory(candidate)) return candidate;
  }
  return undefined;
}

/** `0` listed or answered, `1` refused (no such question, already answered),
 * `2` could not run. */
export async function answerCommand(options: AnswerOptions, deps: AnswerDeps): Promise<number> {
  const root = path.resolve(options.repositoryRoot);
  if (options.changeName === undefined) {
    deps.stderr("openspec-ui-cli: answer requires a change name");
    return 2;
  }
  const changeDir = await changeDirectoryOf(root, options.changeName, deps.rootSources);
  if (changeDir === undefined) {
    deps.stderr(`openspec-ui-cli: "${options.changeName}" is not a change here, nor in a working directory of its own`);
    return 2;
  }

  if (options.questionId === undefined) {
    const open = await openQuestions(changeDir);
    if (options.format === "json") {
      deps.stdout(JSON.stringify({ changeDir, open }, null, 2));
      return 0;
    }
    if (open.length === 0) {
      deps.stdout(`${options.changeName} has no open question.`);
      return 0;
    }
    for (const question of open) {
      deps.stdout(`${question.id}  ${question.text}`);
      deps.stdout(`    asked ${question.askedAt} by ${question.agent}, stage ${question.stage}, run ${question.runId}`);
    }
    deps.stdout("");
    deps.stdout(`Answer one with: openspec-ui-cli answer ${options.changeName} <Q-id> "<answer>"`);
    return 0;
  }

  const answer = options.answer?.trim();
  if (answer === undefined || answer.length === 0) {
    deps.stderr(`openspec-ui-cli: answer ${options.changeName} ${options.questionId} needs the answer, in quotes`);
    return 2;
  }
  let by = "the operator";
  try {
    by = (await (deps.readIdentity ?? ((cwd: string) => createGitWrapper({ cwd }).configuredIdentity()))(root)) ?? by;
  } catch {
    // An answer from somebody unnamed is still the answer.
  }
  const outcome = await answerQuestion(changeDir, options.questionId, { text: answer, by, at: (deps.now ?? (() => new Date()))().toISOString() });
  if (outcome === "answered") {
    deps.stdout(`Answered ${options.questionId} in ${path.join(changeDir, "decisions.md")}; a run waiting on it goes on.`);
    return 0;
  }
  deps.stderr(outcome === "already-answered"
    ? `openspec-ui-cli: ${options.questionId} was already answered; the first answer stands`
    : `openspec-ui-cli: ${options.questionId} is not a question of ${options.changeName}`);
  return 1;
}
