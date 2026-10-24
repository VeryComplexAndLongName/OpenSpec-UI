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
  "OSW-CHG-001",
  "OSW-CHG-002",
  "OSW-CHG-003",
  "OSW-CLI-001",
  "OSW-CLI-002",
  "OSW-CLI-003",
  "OSW-CLI-004",
  "OSW-CLI-005",
  "OSW-CLI-006",
  "OSW-CLI-007",
  "OSW-CLI-008",
  "OSW-CLI-009",
  "OSW-CLI-010",
  "OSW-CLI-011",
  "OSW-CLI-012",
  "OSW-CLI-013",
  "OSW-CLI-014",
  "OSW-CLI-015",
  "OSW-CLI-016",
  "OSW-CLI-017",
  "OSW-CLI-018",
  "OSW-RUN-001",
  "OSW-RUN-002",
  "OSW-RUN-003",
  "OSW-RUN-004",
  "OSW-RUN-005",
  "OSW-RUN-006",
  "OSW-RUN-101",
  "OSW-RUN-102",
  "OSW-RUN-103",
  "OSW-RUN-104",
  "OSW-RUN-201",
  "OSW-RUN-202",
  "OSW-RUN-203",
  "OSW-RUN-204",
  "OSW-RUN-205",
  "OSW-RUN-206",
  "OSW-RUN-207",
  "OSW-RUN-208",
  "OSW-RUN-209",
  "OSW-RUN-210",
  "OSW-RUN-211",
  "OSW-RUN-212",
  "OSW-QST-001",
  "OSW-QST-002",
  "OSW-QST-003",
  "OSW-QST-101",
  "OSW-QST-102",
  "OSW-QST-201",
  "OSW-PRM-101",
  "OSW-PRM-102",
  "OSW-GIT-001",
  "OSW-GIT-002",
  "OSW-GIT-101",
  "OSW-GIT-102",
  "OSW-GIT-103",
  "OSW-GIT-201",
  "OSW-GIT-202",
  "OSW-GIT-203",
  "OSW-PRC-001",
  "OSW-PRC-002",
  "OSW-PRC-003",
  "OSW-PRC-004",
  "OSW-PRC-005",
  "OSW-PRC-006",
  "OSW-PRC-007",
  "OSW-PRC-008",
  "OSW-PRC-009",
  "OSW-PRC-010",
  "OSW-HRN-001",
  "OSW-HRN-002",
  "OSW-HRN-003",
  "OSW-HRN-004",
  "OSW-HRN-005",
  "OSW-HRN-006",
  "OSW-HRN-007",
  "OSW-HRN-008",
  "OSW-HRN-009",
  "OSW-HRN-010",
  "OSW-HRN-011",
  "OSW-HRN-012",
  "OSW-HRN-013",
  "OSW-HRN-014",
  "OSW-HRN-015",
  "OSW-HRN-016",
  "OSW-HRN-017",
  "OSW-HRN-018",
  "OSW-HRN-019",
  "OSW-HRN-020",
  "OSW-HRN-021",
  "OSW-HRN-022",
  "OSW-HRN-023",
  "OSW-HRN-024",
  "OSW-HRN-025",
  "OSW-HRN-026",
  "OSW-HRN-027",
  "OSW-HRN-028",
  "OSW-HRN-029",
  "OSW-HRN-030",
  "OSW-HRN-031",
  "OSW-HRN-032",
  "OSW-HRN-033",
  "OSW-HRN-034",
  "OSW-HRN-035",
  "OSW-HRN-036",
  "OSW-HRN-037",
  "OSW-HRN-038",
  "OSW-HRN-039",
  "OSW-HRN-040",
  "OSW-HRN-041",
  "OSW-HRN-042",
  "OSW-HRN-043",
  "OSW-HRN-044",
  "OSW-HRN-045",
  "OSW-HRN-046",
  "OSW-HRN-047",
  "OSW-HRN-048",
  "OSW-HRN-049",
  "OSW-HRN-050",
  "OSW-HRN-051",
  "OSW-HRN-052",
  "OSW-HRN-053",
  "OSW-HRN-054",
  "OSW-HRN-055",
  "OSW-HRN-056",
  "OSW-HRN-057",
  "OSW-HRN-058",
  "OSW-HRN-059",
  "OSW-HRN-060",
  "OSW-HRN-061",
  "OSW-HRN-062",
  "OSW-HRN-063",
  "OSW-HRN-064",
  "OSW-HRN-065",
  "OSW-HRN-066",
  "OSW-HRN-067",
  "OSW-HRN-068",
  "OSW-HRN-069",
  "OSW-HRN-070",
  "OSW-HRN-071",
  "OSW-HRN-072",
  "OSW-HRN-073",
  "OSW-HRN-074",
  "OSW-HRN-075",
  "OSW-HRN-076",
  "OSW-HRN-077",
  "OSW-HRN-078",
  "OSW-HRN-079",
  "OSW-HRN-080",
  "OSW-HRN-081",
  "OSW-HRN-082",
  "OSW-HRN-083",
  "OSW-HRN-084",
  "OSW-HRN-085",
  "OSW-HRN-086",
  "OSW-HRN-087",
  "OSW-HRN-088",
  "OSW-HRN-089",
  "OSW-HRN-090",
  "OSW-HRN-091",
  "OSW-HRN-092",
  "OSW-HRN-093",
  "OSW-HRN-094",
  "OSW-HRN-095",
  "OSW-HRN-096",
  "OSW-HRN-097",
  "OSW-HRN-098",
  "OSW-HRN-099",
  "OSW-HRN-100",
  "OSW-HRN-101",
  "OSW-HRN-102",
  "OSW-HRN-103",
  "OSW-HRN-104",
  "OSW-HRN-105",
  "OSW-HRN-106",
  "OSW-HRN-107",
  "OSW-HRN-108",
  "OSW-HRN-109",
  "OSW-HRN-110",
  "OSW-HRN-111",
  "OSW-HRN-112",
  "OSW-HRN-113",
  "OSW-HRN-114",
  "OSW-HRN-115",
  "OSW-HRN-116",
  "OSW-HRN-117",
  "OSW-HRN-118",
  "OSW-HRN-119",
  "OSW-HRN-120",
  "OSW-HRN-121",
  "OSW-HRN-122",
  "OSW-HRN-123",
  "OSW-HRN-124",
  "OSW-HRN-125",
  "OSW-HRN-126",
  "OSW-HRN-127",
  "OSW-AGT-001",
  "OSW-AGT-002",
  "OSW-AGT-003",
  "OSW-AGT-004",
  "OSW-AGT-005",
  "OSW-AGT-006",
  "OSW-AGT-007",
  "OSW-AGT-008",
  "OSW-AGT-009",
  "OSW-AGT-010",
  "OSW-AGT-101",
  "OSW-AGT-102",
  "OSW-AGT-103",
  "OSW-AGT-104",
  "OSW-AGT-201",
  "OSW-AGT-202",
  "OSW-AGT-203",
  "OSW-AGT-204",
  "OSW-AGT-205",
  "OSW-AGT-206",
  "OSW-AGT-207",
  "OSW-AGT-208",
  "OSW-AGT-209",
  "OSW-AGT-210",
  "OSW-AGT-211",
  "OSW-AGT-212",
  "OSW-AGT-213",
  "OSW-AGT-214",
  "OSW-AGT-215",
  "OSW-AGT-216",
  "OSW-AGT-217",
  "OSW-AGT-218",
  "OSW-AGT-219",
  "OSW-AGT-220",
  "OSW-AGT-221",
  "OSW-AGT-222",
  "OSW-TSK-001",
  "OSW-TSK-002",
  "OSW-TSK-003",
  "OSW-TSK-004",
  "OSW-TSK-005",
  "OSW-TSK-006",
  "OSW-TSK-007",
  "OSW-TSK-008",
  "OSW-TSK-009",
  "OSW-TSK-010",
  "OSW-TSK-011",
  "OSW-TSK-012",
  "OSW-TSK-013",
  "OSW-TSK-014",
  "OSW-TSK-015",
  "OSW-TSK-016",
  "OSW-TSK-017",
  "OSW-TSK-018",
  "OSW-TSK-019",
  "OSW-TSK-020",
  "OSW-TSK-021",
  "OSW-TSK-022",
  "OSW-TSK-023",
  "OSW-TSK-024",
  "OSW-TSK-025",
  "OSW-TSK-026",
  "OSW-TSK-027",
  "OSW-TSK-028",
  "OSW-TSK-029",
  "OSW-TSK-030",
  "OSW-TSK-031",
  "OSW-TSK-032",
  "OSW-TSK-033",
  "OSW-TSK-034",
  "OSW-TSK-035",
  "OSW-TSK-036",
  "OSW-TSK-101",
  "OSW-VAL-001",
  "OSW-VAL-002",
  "OSW-VAL-003",
  "OSW-VAL-004",
  "OSW-VAL-005",
  "OSW-VAL-006",
  "OSW-VAL-007",
  "OSW-VAL-008",
  "OSW-VAL-009",
  "OSW-VAL-010",
  "OSW-VAL-101",
  "OSW-VAL-102",
  "OSW-VAL-103",
  "OSW-VAL-104",
  "OSW-VAL-105",
  "OSW-VAL-106",
  "OSW-VAL-107",
  "OSW-VAL-108",
  "OSW-VAL-109",
  "OSW-VAL-110",
  "OSW-VAL-111",
  "OSW-VAL-112",
  "OSW-VAL-113",
  "OSW-VAL-114",
  "OSW-VAL-115",
  "OSW-VAL-116",
  "OSW-VAL-117",
  "OSW-VAL-118",
  "OSW-VAL-119",
  "OSW-VAL-120",
  "OSW-VAL-121",
  "OSW-ARC-001",
  "OSW-ARC-002",
  "OSW-ARC-003",
  "OSW-ARC-004",
  "OSW-ARC-005",
  "OSW-ARC-006",
  "OSW-ARC-007",
  "OSW-ARC-101",
  "OSW-ARC-102",
  "OSW-ARC-103",
  "OSW-ARC-104",
  "OSW-ARC-105",
  "OSW-ARC-106",
  "OSW-ARC-107",
  "OSW-ARC-108",
  "OSW-ARC-201",
  "OSW-ARC-202",
  "OSW-ARC-203",
  "OSW-ARC-204",
  "OSW-ARC-205",
  "OSW-ARC-206",
  "OSW-ARC-207",
  "OSW-ARC-208",
  "OSW-ARC-209",
  "OSW-WSP-001",
  "OSW-WSP-002",
  "OSW-WSP-003",
  "OSW-WSP-004",
  "OSW-WSP-005",
  "OSW-WSP-006",
  "OSW-WSP-007",
  "OSW-WSP-008",
  "OSW-WSP-009",
  "OSW-WSP-101",
  "OSW-WSP-102",
  "OSW-WSP-103",
  "OSW-WSP-104",
  "OSW-WSP-105",
  "OSW-KEY-001",
  "OSW-KEY-002",
  "OSW-KEY-003",
  "OSW-KEY-004",
  "OSW-KEY-005",
  "OSW-KEY-006",
  "OSW-KEY-007",
  "OSW-KEY-008",
  "OSW-KEY-009",
  "OSW-KEY-010",
  "OSW-KEY-011",
  "OSW-KEY-012",
  "OSW-KEY-013",
  "OSW-KEY-014",
  "OSW-KEY-015",
  "OSW-KEY-016",
  "OSW-KEY-017",
  "OSW-KEY-018",
  "OSW-KEY-019",
  "OSW-KEY-020",
  "OSW-KEY-021",
  "OSW-KEY-022",
  "OSW-KEY-023",
  "OSW-KEY-024",
  "OSW-KEY-025",
  "OSW-KEY-026",
  "OSW-KEY-027",
  "OSW-KEY-028",
  "OSW-KEY-029",
  "OSW-KEY-030",
  "OSW-KEY-031",
  "OSW-NET-001",
  "OSW-NET-002",
  "OSW-NET-003",
  "OSW-NET-004",
  "OSW-NET-005",
  "OSW-NET-006",
  "OSW-NET-007",
  "OSW-NET-008",
  "OSW-NET-009",
  "OSW-NET-010",
  "OSW-NET-101",
  "OSW-NET-102",
  "OSW-NET-103",
  "OSW-NET-104",
  "OSW-NET-105",
  "OSW-NET-106",
  "OSW-NET-201",
  "OSW-NET-202",
  "OSW-NET-203",
  "OSW-NET-204",
  "OSW-NET-205",
];

/** Messages said in place rather than from the register, counted by
 * `countUnregistered`. The number may only fall: a change that moves
 * messages into the register lowers it here, and a new message said in
 * place fails this test. 323 before the register existed; 290 once the
 * CLI, RUN, QST and PRM groups moved into it (2026-10-09); 472 when the
 * counter widened to every carrier (2026-10-12) - the four forms it
 * counted held 290, and the `message:`/`problem:` fields, the
 * `refused(...)` reasons, the `describe*` sentences and the refusal
 * classes' messages added 182 that were said in place all along; 330 once
 * the eight remaining groups - HRN, AGT, TSK, VAL, ARC, WSP, KEY, NET -
 * moved into the register (2026-10-12). */
const UNREGISTERED_MESSAGES = 330;

/** Where a message is said as a sentence written in place: a CLI line, a
 * VS Code notification, a failure or a refusal's reason, a validator's
 * thrown message, a `refused(...)` result, a `describe*` formatter's
 * sentence, a check's `message:`/`problem:` field. A rough measure by
 * design - it counts the forms that say most of what a person reads, and a
 * message said by its identifier has none of them. */
const SAID_IN_PLACE = [
  /\bstderr\(\s*[`"']/gu,
  /\bshow(?:Error|Warning|Information)Message\(\s*[`"']/gu,
  /\bfailedEvent\(\s*[\w.]+,\s*[`"']/gu,
  /\breason:\s*[`"']/gu,
  /\bmessage:\s*[`"']/gu,
  /\bproblem:\s*[`"']/gu,
  /\brefused\(\s*[`"']/gu,
  /\bsuper\(\s*[`"']/gu,
  // A `describe*` formatter's sentence: from its declaration to the first
  // sentence it returns.
  /\b(?:export\s+)?(?:function\s+)?describe[A-Z][A-Za-z]*\b[\s\S]*?\breturn\s+[`"']/gu,
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

  it("has at least one entry in every group ADR 0046 names", () => {
    const empty = MESSAGE_GROUPS
      .map((group) => group.group)
      .filter((group) => !entries.some(([code]) => code.startsWith(`OSW-${group}-`)));

    expect(empty).toEqual([]);
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
