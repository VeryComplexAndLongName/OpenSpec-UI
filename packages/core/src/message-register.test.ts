import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it, vi } from "vitest";
import {
  MESSAGE_GROUPS,
  MESSAGES,
  formatMessage,
  isMessageCode,
  messageEntryUrl,
  renderMessagesPage,
  say,
  withMessageCode,
  type MessageEntry,
} from "./message-register.js";

// every-message-has-an-identifier (ADR 0046).

// The ratchet reads every source file of the five packages. Measured
// 2026-10-09 on this machine, idle: 0.36 s. Sized for a loaded runner.
vi.setConfig({ testTimeout: 15_000 });

const REPOSITORY = path.join(path.dirname(fileURLToPath(import.meta.url)), "..", "..", "..");

/** Every identifier ever given, in the order it was given. A new message is
 * added here as well as to the register; nothing is ever taken out, so an
 * identifier once given can be neither dropped nor given again. */
const GIVEN = [
  "OSW-CHG-001", "OSW-CHG-002", "OSW-CHG-003",
  "OSW-CLI-001", "OSW-CLI-002", "OSW-CLI-003", "OSW-CLI-004", "OSW-CLI-005", "OSW-CLI-006", "OSW-CLI-007", "OSW-CLI-008",
  "OSW-CLI-009", "OSW-CLI-010", "OSW-CLI-011", "OSW-CLI-012", "OSW-CLI-013", "OSW-CLI-014", "OSW-CLI-015", "OSW-CLI-016",
  "OSW-RUN-001", "OSW-RUN-002", "OSW-RUN-003", "OSW-RUN-004", "OSW-RUN-005", "OSW-RUN-006",
  "OSW-RUN-101", "OSW-RUN-102", "OSW-RUN-103", "OSW-RUN-104",
  "OSW-RUN-201", "OSW-RUN-202", "OSW-RUN-203", "OSW-RUN-204", "OSW-RUN-205", "OSW-RUN-206", "OSW-RUN-207",
  "OSW-RUN-208", "OSW-RUN-209", "OSW-RUN-210", "OSW-RUN-211", "OSW-RUN-212",
  "OSW-QST-001", "OSW-QST-002", "OSW-QST-003", "OSW-QST-101", "OSW-QST-102", "OSW-QST-201",
  "OSW-PRM-101", "OSW-PRM-102",
  "OSW-GIT-001", "OSW-GIT-002", "OSW-GIT-101", "OSW-GIT-102", "OSW-GIT-201", "OSW-GIT-202", "OSW-GIT-203", "OSW-GIT-103",
];

/** Messages said in place rather than from the register, counted by
 * `countUnregistered`. The number may only fall: a change that moves
 * messages into the register lowers it here, and a new message said in
 * place fails this test. 323 before the register existed; 290 once the
 * CLI, RUN, QST and PRM groups moved into it (2026-10-09). */
const UNREGISTERED_MESSAGES = 290;

/** Where a message is said as a sentence written in place: a CLI line, a
 * VS Code notification, a failure or a refusal's reason. A rough measure by
 * design - it counts the forms that say most of what a person reads, and a
 * message said by its identifier has none of them. */
const SAID_IN_PLACE = [
  /\bstderr\(\s*[`"']/gu,
  /\bshow(?:Error|Warning|Information)Message\(\s*[`"']/gu,
  /\bfailedEvent\(\s*[\w.]+,\s*[`"']/gu,
  /\breason:\s*[`"']/gu,
];

function sourceFiles(): string[] {
  const files: string[] = [];
  for (const pkg of ["cli", "core", "extension", "server", "webui"]) {
    const root = path.join(REPOSITORY, "packages", pkg, "src");
    for (const entry of readdirSync(root, { recursive: true, withFileTypes: true })) {
      if (!entry.isFile() || !/\.tsx?$/u.test(entry.name) || /\.test\.tsx?$/u.test(entry.name)) continue;
      const file = path.join(entry.parentPath, entry.name);
      if (/[\\/](test-support|fixtures|e2e)[\\/]/u.test(file)) continue;
      files.push(file);
    }
  }
  return files;
}

function countUnregistered(): number {
  let count = 0;
  for (const file of sourceFiles()) {
    const text = readFileSync(file, "utf8");
    for (const pattern of SAID_IN_PLACE) count += text.match(pattern)?.length ?? 0;
  }
  return count;
}

describe("the message register", () => {
  const entries = Object.entries(MESSAGES) as Array<[string, MessageEntry]>;

  it("names every message OSW-<GROUP>-<NNN>, in a group that exists, with its words, why and what to do", () => {
    const groups = new Set(MESSAGE_GROUPS.map((group) => group.group));
    const wrong = entries.filter(([code, entry]) => {
      const match = /^OSW-([A-Z]{3})-(\d{3})$/u.exec(code);
      return match === null || !groups.has(match[1] as never)
        || entry.text.trim() === "" || entry.why.trim() === "" || entry.todo.trim() === "";
    });

    expect(wrong.map(([code]) => code)).toEqual([]);
  });

  it("keeps every identifier ever given, and gives none twice", () => {
    expect(GIVEN.filter((code, index) => GIVEN.indexOf(code) !== index)).toEqual([]);
    expect(GIVEN.filter((code) => !isMessageCode(code))).toEqual([]);
    expect(entries.map(([code]) => code).filter((code) => !GIVEN.includes(code))).toEqual([]);
  });

  it("is what docs/messages.md says", () => {
    // Out of date? npm run messages --workspace @openspec-ui/core
    const page = readFileSync(path.join(REPOSITORY, "docs", "messages.md"), "utf8").replace(/\r/gu, "");
    expect(page).toBe(renderMessagesPage());
  });

  it("says a message with its values put in, on a line of its own or after how a run ended", () => {
    const said = say("OSW-QST-003", { question: "Q-7", change: "demo" });

    expect(said).toEqual({ code: "OSW-QST-003", level: "error", text: "Q-7 is not a question of demo" });
    expect(formatMessage(said)).toBe("error OSW-QST-003: Q-7 is not a question of demo");
    expect(withMessageCode(said.text, said.code)).toBe("OSW-QST-003: Q-7 is not a question of demo");
    expect(withMessageCode("no identifier yet", undefined)).toBe("no identifier yet");
    expect(messageEntryUrl("OSW-RUN-104")).toMatch(/docs\/messages\.md#osw-run-104$/u);
  });

  it("puts a value in as it is, even one that looks like a placeholder", () => {
    expect(say("OSW-QST-002", { question: "{change}" }).text).toBe("{change} was already answered; the first answer stands");
  });

  it("lets the number of messages said in place only fall", () => {
    const count = countUnregistered();

    expect(count, "a message said in place: put it in the register, or lower nothing").toBeLessThanOrEqual(UNREGISTERED_MESSAGES);
    expect(count, `fewer messages are said in place: lower UNREGISTERED_MESSAGES to ${count}`).toBe(UNREGISTERED_MESSAGES);
  });
});
