import { generateKeyPairSync, sign } from "node:crypto";
import { mkdir, mkdtemp, readdir, readFile, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  actorFromEnvironment,
  checkHistories,
  HistoryRefusedError,
  readChangeHistory,
  readHistoryFile,
  recordHistoryEvent,
  reopenTasks,
} from "./change-history.js";
import { describeHistoryEvent, parseHistoryEvent, playHistory, type HistoryEntry, type HistoryEvent } from "./change-history-facts.js";
import { keyIdOf, type MachineKey } from "./machine-key.js";
import { peopleRoster, type Person } from "./people.js";
import { sealEnvelope } from "./signed-envelope.js";

// a-change-keeps-its-history, ADR 0037 decisions 3 and 4.
//
// every-varying-check-has-a-budget: Ed25519 keys are generated and small
// files written to temporary directories. Measured on 2026-09-22: the file
// takes under 300 ms; the budget leaves room for a loaded machine.
vi.setConfig({ testTimeout: 10_000 });

function memoryKey(): MachineKey {
  const { privateKey, publicKey } = generateKeyPairSync("ed25519");
  return {
    keyId: keyIdOf(publicKey),
    publicKeyPem: publicKey.export({ type: "spki", format: "pem" }).toString(),
    publicKey: publicKey.export({ type: "spki", format: "der" }).toString("base64"),
    sign: (bytes) => new Uint8Array(sign(null, bytes, privateKey)),
  };
}

function personOf(handle: string, key: MachineKey): Person {
  return { handle, name: handle.toUpperCase(), keys: [{ keyId: key.keyId, publicKey: key.publicKey, addedAt: "2026-09-22" }] };
}

const ADA = memoryKey();
const BOB = memoryKey();
const EVE = memoryKey();
const TEAM = [personOf("ada", ADA), personOf("bob", BOB)];

let clock = Date.parse("2026-09-22T10:00:00Z");
const tick = () => new Date((clock += 60_000));

/** A signed event, as a history file holds it. */
function signed(key: MachineKey, event: Partial<HistoryEvent> & Pick<HistoryEvent, "type">, handle: string): string {
  const full = { version: 1, change: "demo", at: tick().toISOString(), by: { handle, keyId: key.keyId }, actor: { kind: "person" }, ...event };
  return JSON.stringify(sealEnvelope(new TextEncoder().encode(JSON.stringify(full)), key));
}

function entry(file: string, text: string, people: readonly Person[] = TEAM): HistoryEntry {
  return readHistoryFile(file, text, peopleRoster(people));
}

const team = new Set(["ada", "bob"]);

describe("an event", () => {
  it("reads each kind, and says what is wrong with one that is not an event", () => {
    const base = { version: 1, change: "demo", at: "2026-09-22T10:00:00Z", by: { handle: "ada", keyId: "k" }, actor: { kind: "agent", agent: "claude-code" } };

    expect(parseHistoryEvent({ ...base, type: "owner-set", to: "ada" })).toMatchObject({ event: { type: "owner-set", to: "ada", actor: { kind: "agent", agent: "claude-code" } } });
    expect(parseHistoryEvent({ ...base, type: "implementer-set", to: null })).toMatchObject({ event: { to: null } });
    expect(parseHistoryEvent({ ...base, type: "sent-back", toStage: "archived", reason: "x", reopened: [] })).toEqual({ problem: "it does not name a stage a change can be sent back to" });
    expect(parseHistoryEvent({ ...base, type: "sent-back", toStage: "planned", reason: " ", reopened: [] })).toEqual({ problem: "it gives no reason" });
    expect(parseHistoryEvent({ ...base, type: "renamed" })).toEqual({ problem: "its type is not one this product knows" });
  });

  it("is said in words, with an agent named as the person's agent", () => {
    const event = parseHistoryEvent({
      version: 1, change: "demo", at: "2026-09-22T10:00:00Z", by: { handle: "ada", keyId: "k" },
      actor: { kind: "agent", agent: "claude-code" }, type: "sent-back", toStage: "in-progress", reason: "the review found a gap", reopened: [{ task: "2.3", why: "untested" }],
    });

    expect("event" in event && describeHistoryEvent(event.event)).toBe("ada's agent claude-code sent it back to In progress, reopening 2.3: the review found a gap");
  });
});

describe("the rules a history is held to", () => {
  it("lets anyone set the first Owner, the Owner set the Implementer, and the Implementer hand the work back", () => {
    const played = playHistory("demo", [
      entry("1.json", signed(BOB, { type: "owner-set", to: "ada" }, "bob")),
      entry("2.json", signed(ADA, { type: "implementer-set", to: "bob" }, "ada")),
      entry("3.json", signed(BOB, { type: "sent-back", toStage: "planned", reason: "scope", reopened: [] }, "bob")),
      entry("4.json", signed(BOB, { type: "implementer-set", to: null }, "bob")),
    ], team);

    expect(played).toEqual({ roles: { owner: "ada" }, problems: [] });
  });

  it("refuses a hand-over by anyone but the Owner, an Implementer set without an Owner, and a send-back by a bystander", () => {
    const withoutOwner = playHistory("demo", [entry("1.json", signed(ADA, { type: "implementer-set", to: "bob" }, "ada"))], team);
    expect(withoutOwner.problems.map((one) => one.problem)).toEqual(["the change has no Owner yet, and the Owner sets the Implementer"]);

    const played = playHistory("demo", [
      entry("1.json", signed(ADA, { type: "owner-set", to: "ada" }, "ada")),
      entry("2.json", signed(BOB, { type: "owner-set", to: "bob" }, "bob")),
      entry("3.json", signed(BOB, { type: "sent-back", toStage: "planned", reason: "mine now", reopened: [] }, "bob")),
    ], team);
    expect(played.roles).toEqual({ owner: "ada" });
    expect(played.problems.map((one) => one.problem)).toEqual([
      "only the Owner, ada, hands the ownership on",
      "only the Owner or the Implementer sends a change back",
    ]);
  });

  it("refuses a file signed by a key nobody holds, one about another change, one naming someone off the team, and one that lies about its signer", () => {
    const played = playHistory("demo", [
      entry("1.json", signed(EVE, { type: "owner-set", to: "ada" }, "eve")),
      entry("2.json", signed(ADA, { type: "owner-set", to: "ada", change: "other" }, "ada")),
      entry("3.json", signed(ADA, { type: "owner-set", to: "eve" }, "ada")),
      entry("4.json", signed(ADA, { type: "owner-set", to: "ada" }, "bob")),
    ], team);

    expect(played.problems.map((one) => one.problem)).toEqual([
      `it is signed by key ${EVE.keyId}, which is in nobody's file in openspec/people`,
      "it is about other, not demo",
      "it names eve as the Owner, who is not on the team",
      "it says it was signed by someone other than whoever signed it",
    ]);
  });
});

describe("reopening items", () => {
  it("unticks each named item and writes when, by whom and why under it, below its own lines", () => {
    const tasks = ["## 1. Work", "", "- [x] 1.1 First", "  carried on", "- [x] 1.2 Second", "- [ ] 1.3 Third", ""].join("\n");

    expect(reopenTasks(tasks, [{ task: "1.1", why: "it broke" }, { task: "1.2", why: "untested" }], "ada", "2026-09-22")).toBe([
      "## 1. Work", "", "- [ ] 1.1 First", "  carried on", "  Reopened on 2026-09-22 by ada: it broke",
      "- [ ] 1.2 Second", "  Reopened on 2026-09-22 by ada: untested", "- [ ] 1.3 Third", "",
    ].join("\n"));
  });

  it("refuses an item the list does not have, and one that is open", () => {
    const tasks = "- [ ] 1.1 Open\n";

    expect(() => reopenTasks(tasks, [{ task: "9.9", why: "x" }], "ada", "2026-09-22")).toThrow("tasks.md has no item 9.9");
    expect(() => reopenTasks(tasks, [{ task: "1.1", why: "x" }], "ada", "2026-09-22")).toThrow("is not closed");
  });
});

describe("who acts", () => {
  it("is the agent the environment names, and the person where it names none", () => {
    expect(actorFromEnvironment({ AI_AGENT: "claude-code_2-1-278_agent" })).toEqual({ kind: "agent", agent: "claude-code" });
    expect(actorFromEnvironment({ OPENSPEC_UI_AGENT: "codex-cli", OPENSPEC_UI_RUN_ID: "r1", AI_AGENT: "x" })).toEqual({ kind: "agent", agent: "codex-cli", runId: "r1" });
    expect(actorFromEnvironment({ CLAUDECODE: "1" })).toEqual({ kind: "agent", agent: "claude-code" });
    expect(actorFromEnvironment({})).toEqual({ kind: "person" });
  });
});

const roots: string[] = [];
afterEach(async () => {
  await Promise.all(roots.splice(0).map((root) => rm(root, { recursive: true, force: true })));
});

async function repository(): Promise<string> {
  const root = await mkdtemp(path.join(os.tmpdir(), "openspec-history-"));
  roots.push(root);
  await mkdir(path.join(root, "openspec", "people"), { recursive: true });
  for (const person of TEAM) await writeFile(path.join(root, "openspec", "people", `${person.handle}.json`), JSON.stringify(person), "utf8");
  await mkdir(path.join(root, "openspec", "changes", "demo"), { recursive: true });
  await writeFile(path.join(root, "openspec", "changes", "demo", "proposal.md"), "## Why\n\nBecause.\n", "utf8");
  await writeFile(path.join(root, "openspec", "changes", "demo", "tasks.md"), "## 1. Work\n\n- [x] 1.1 Did it\n", "utf8");
  return root;
}

const person = { kind: "person" } as const;

describe("recording an event", () => {
  it("signs and writes one file per event, and plays the roles forward from them", async () => {
    const root = await repository();

    await recordHistoryEvent(root, "demo", { type: "owner-set", to: "ada" }, { key: ADA, actor: person, now: tick });
    const second = await recordHistoryEvent(root, "demo", { type: "implementer-set", to: "bob" }, { key: ADA, actor: { kind: "agent", agent: "claude-code" }, now: tick });

    expect(second.roles).toEqual({ owner: "ada", implementer: "bob" });
    expect(await readdir(path.join(root, "openspec", "changes", "demo", "history"))).toHaveLength(2);
    const history = await readChangeHistory(root, "demo");
    expect(history.problems).toEqual([]);
    expect(history.entries.map((one) => one.signature)).toEqual(["verified", "verified"]);
    expect(history.entries[1]?.event).toMatchObject({ actor: { kind: "agent", agent: "claude-code" }, by: { handle: "ada" } });
  });

  it("reopens the items it sends back, with the reason under each", async () => {
    const root = await repository();
    await recordHistoryEvent(root, "demo", { type: "owner-set", to: "ada" }, { key: ADA, actor: person, now: tick });

    const sent = await recordHistoryEvent(root, "demo", { type: "sent-back", toStage: "in-progress", reason: "review found a gap", reopened: [{ task: "1.1", why: "no test" }] }, { key: ADA, actor: person, now: tick });

    expect(sent.tasksFile).toBe("openspec/changes/demo/tasks.md");
    expect(await readFile(path.join(root, "openspec", "changes", "demo", "tasks.md"), "utf8")).toContain("- [ ] 1.1 Did it\n  Reopened on 2026-09-22 by ada: no test");
  });

  it("refuses what the rules refuse, and a machine whose key is on nobody's file, writing nothing", async () => {
    const root = await repository();
    await recordHistoryEvent(root, "demo", { type: "owner-set", to: "ada" }, { key: ADA, actor: person, now: tick });

    await expect(recordHistoryEvent(root, "demo", { type: "owner-set", to: "bob" }, { key: BOB, actor: person, now: tick })).rejects.toThrow("only the Owner, ada, hands the ownership on");
    await expect(recordHistoryEvent(root, "demo", { type: "owner-set", to: "ada" }, { key: EVE, actor: person, now: tick })).rejects.toThrow(HistoryRefusedError);
    await expect(recordHistoryEvent(root, "nothing-here", { type: "owner-set", to: "ada" }, { key: ADA, actor: person })).rejects.toThrow("is not an active change");
    expect(await readdir(path.join(root, "openspec", "changes", "demo", "history"))).toHaveLength(1);
  });
});

describe("what a pull request did to the histories", () => {
  async function withHistory(): Promise<{ root: string; file: string; text: string }> {
    const root = await repository();
    const recorded = await recordHistoryEvent(root, "demo", { type: "owner-set", to: "ada" }, { key: ADA, actor: person, now: tick });
    return { root, file: recorded.file, text: await readFile(path.join(root, recorded.file), "utf8") };
  }

  function baseWith(files: Record<string, string>) {
    return {
      ref: "origin/main",
      git: {
        listFilesUnder: async () => Object.keys(files),
        showFile: async (_ref: string, file: string) => files[file],
      },
    };
  }

  it("accepts a history the base has, unchanged, and one moved with its change into the archive", async () => {
    const { root, file, text } = await withHistory();
    expect(await checkHistories(root, TEAM, baseWith({ [file]: text }))).toEqual([]);

    const archived = path.join(root, "openspec", "changes", "archive", "2026-09-22-demo", "history");
    await mkdir(archived, { recursive: true });
    const name = path.basename(file);
    await writeFile(path.join(archived, name), text, "utf8");
    await rm(path.join(root, file));
    expect(await checkHistories(root, TEAM, baseWith({ [file]: text }))).toEqual([]);
  });

  it("refuses a history file deleted or changed", async () => {
    const { root, file, text } = await withHistory();
    await writeFile(path.join(root, file), text.replace("\"version\": 2", "\"version\": 2 "), "utf8");

    expect(await checkHistories(root, TEAM, baseWith({ [file]: `${text} ` }))).toEqual([{ file, problem: "a history file was changed; history is only ever added to" }]);
    await rm(path.join(root, file));
    expect(await checkHistories(root, TEAM, baseWith({ [file]: text }))).toEqual([{ file, problem: "a history file was deleted; history is only ever added to" }]);
  });

  it("refuses a file the pull request adds that breaks a rule, and judges nothing the base already had", async () => {
    const { root, file, text } = await withHistory();
    const added = "openspec/changes/demo/history/20990101T000000Z-bob-owner-set.json";
    await writeFile(path.join(root, added), signed(BOB, { type: "owner-set", to: "bob", at: "2099-01-01T00:00:00Z" }, "bob"), "utf8");

    expect(await checkHistories(root, TEAM, baseWith({ [file]: text }))).toEqual([{ file: added, problem: "only the Owner, ada, hands the ownership on" }]);
  });
});
