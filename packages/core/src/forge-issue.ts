import { say, withMessageCode } from "./message-register.js";

export function issueError(code: `OSW-CHG-0${20 | 21 | 22 | 23 | 24 | 25 | 26 | 27 | 28 | 29 | 30 | 31 | 32}`): Error {
  return new Error(withMessageCode(say(code).text, code));
}

/** An issue read from the configured repository, never a URL to fetch. */
export interface ForgeIssue {
  number: number;
  title: string;
  body: string;
  state: string;
  updatedAt: string;
}

export function assertIssueNumber(number: number): void {
  if (!Number.isSafeInteger(number) || number <= 0) throw issueError("OSW-CHG-020");
}

export function readForgeIssue(value: unknown, number: number, kind: "github" | "gitlab" | "gitea"): ForgeIssue {
  assertIssueNumber(number);
  if (!value || typeof value !== "object") throw issueError("OSW-CHG-021");
  const item = value as Record<string, unknown>;
  if (item.pull_request || item.type === "pull_request") throw issueError("OSW-CHG-022");
  if ((kind === "gitlab" ? item.iid : item.number) !== number || typeof item.title !== "string") {
    throw issueError("OSW-CHG-023");
  }
  const body = kind === "gitlab" ? item.description : item.body;
  if (body !== null && body !== undefined && typeof body !== "string") throw issueError("OSW-CHG-024");
  const issue = { number, title: item.title, body: typeof body === "string" ? body : "",
    state: typeof item.state === "string" ? item.state : "unknown",
    updatedAt: typeof item.updated_at === "string" ? item.updated_at : "unknown" };
  if (Buffer.byteLength(JSON.stringify(issue), "utf8") > 256 * 1024) throw issueError("OSW-CHG-025");
  return issue;
}
