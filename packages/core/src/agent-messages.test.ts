import { generateKeyPairSync, sign } from "node:crypto";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  askRunToStop,
  myRosterLabel,
  readStopRequests,
  readUnopenedRequests,
  STOP_MESSAGE_STALE_AFTER_MS,
} from "./agent-messages.js";
import { keyIdOf, type MachineKey } from "./machine-key.js";
import type { Roster } from "./signed-envelope.js";

// every-varying-check-has-a-budget: small file writes in a temporary
// directory and in-memory Ed25519 keys. No git, no agent.
vi.setConfig({ testTimeout: 15_000 });

// a-run-elsewhere-can-be-asked-to-stop 1.5.

function memoryKey(): MachineKey {
  const { privateKey, publicKey } = generateKeyPairSync("ed25519");
  return {
    keyId: keyIdOf(publicKey),
    publicKeyPem: publicKey.export({ type: "spki", format: "pem" }).toString(),
    publicKey: publicKey.export({ type: "spki", format: "der" }).toString("base64"),
    sign: (bytes) => new Uint8Array(sign(null, bytes, privateKey)),
  };
}

function rosterWith(key: MachineKey, label = "Ada"): Roster {
  return new Map([[key.keyId, { keyId: key.keyId, label, publicKey: key.publicKey }]]);
}

const directories: string[] = [];
afterEach(async () => {
  await Promise.all(directories.splice(0).map((directory) => rm(directory, { recursive: true, force: true })));
});

async function messageDirectory(): Promise<string> {
  const directory = await mkdtemp(path.join(os.tmpdir(), "openspec-agent-messages-"));
  directories.push(directory);
  return path.join(directory, ".agent-messages");
}

const SENT_AT = new Date("2026-09-14T10:00:00.000Z");
const INSTANCE = "run-b";

async function asked(directory: string, key: MachineKey, to = INSTANCE): Promise<string> {
  return askRunToStop({ directory, to, reason: "live check", key, machine: "machine-a", now: () => SENT_AT });
}

describe("readStopRequests", () => {
  it("acts on a verified, fresh request for this run, naming the enrolled person", async () => {
    const directory = await messageDirectory();
    const key = memoryKey();
    const messageId = await asked(directory, key);

    const readings = await readStopRequests({ directory, instanceId: INSTANCE, roster: rosterWith(key), now: new Date(SENT_AT.getTime() + 5_000), seen: new Set() });

    expect(readings).toEqual([
      expect.objectContaining({
        state: "act",
        message: expect.objectContaining({ messageId, to: INSTANCE, reason: "live check", machine: "machine-a" }),
        person: expect.objectContaining({ label: "Ada", keyId: key.keyId }),
      }),
    ]);
  });

  it("refuses the same request a second time as seen", async () => {
    const directory = await messageDirectory();
    const key = memoryKey();
    const messageId = await asked(directory, key);

    const readings = await readStopRequests({ directory, instanceId: INSTANCE, roster: rosterWith(key), now: SENT_AT, seen: new Set([messageId]) });

    expect(readings).toEqual([expect.objectContaining({ state: "refused", why: "seen" })]);
  });

  it("refuses a request 61 seconds old as stale", async () => {
    const directory = await messageDirectory();
    const key = memoryKey();
    await asked(directory, key);

    const readings = await readStopRequests({ directory, instanceId: INSTANCE, roster: rosterWith(key), now: new Date(SENT_AT.getTime() + STOP_MESSAGE_STALE_AFTER_MS + 1_000), seen: new Set() });

    expect(readings).toEqual([expect.objectContaining({ state: "refused", why: "stale" })]);
  });

  it("refuses a request from a key nobody enrolled as unverified", async () => {
    const directory = await messageDirectory();
    await asked(directory, memoryKey());

    const readings = await readStopRequests({ directory, instanceId: INSTANCE, roster: new Map(), now: SENT_AT, seen: new Set() });

    expect(readings).toEqual([expect.objectContaining({ state: "refused", why: "unverified" })]);
  });

  it("parses nothing from a request with one changed byte, returns it for no run, and lists it as unopened", async () => {
    const directory = await messageDirectory();
    const key = memoryKey();
    const messageId = await asked(directory, key);
    const filePath = path.join(directory, `${messageId}.json`);
    const envelope = JSON.parse(await readFile(filePath, "utf8")) as { payload: string };
    const payload = Buffer.from(envelope.payload, "base64");
    payload[payload.length - 2] = (payload[payload.length - 2] ?? 0) ^ 1;
    await writeFile(filePath, JSON.stringify({ ...envelope, payload: payload.toString("base64") }), "utf8");

    const roster = rosterWith(key);
    for (const instanceId of [INSTANCE, "run-c"]) {
      expect(await readStopRequests({ directory, instanceId, roster, now: SENT_AT, seen: new Set() })).toEqual([]);
    }
    expect(await readUnopenedRequests(directory, roster)).toEqual([`${messageId}.json`]);
  });

  it("does not return a request addressed to another run", async () => {
    const directory = await messageDirectory();
    const key = memoryKey();
    await asked(directory, key, "run-c");

    expect(await readStopRequests({ directory, instanceId: INSTANCE, roster: rosterWith(key), now: SENT_AT, seen: new Set() })).toEqual([]);
    expect(await readUnopenedRequests(directory, rosterWith(key))).toEqual([]);
  });

  // a-run-elsewhere-can-be-asked-to-stop 3.2: the label a host passes to its
  // cards as myLabel.
  it("finds this machine's roster label, and loads no key where nobody is enrolled", async () => {
    const key = memoryKey();
    const loadKey = vi.fn(async () => key);

    expect(await myRosterLabel("/wt/repo/.agent-status", { loadKey, readRoster: async () => new Map() })).toBeUndefined();
    expect(loadKey).not.toHaveBeenCalled();

    expect(await myRosterLabel("/wt/repo/.agent-status", { loadKey, readRoster: async () => rosterWith(key, "Ada") })).toBe("Ada");
    expect(await myRosterLabel("/wt/repo/.agent-status", { loadKey, readRoster: async () => rosterWith(memoryKey(), "Bob") })).toBeUndefined();
  });

  it("reads the roster beside the status directory", async () => {
    const readRoster = vi.fn(async () => new Map());

    await myRosterLabel(path.join("/wt", "repo", ".agent-status"), { readRoster });

    expect(readRoster).toHaveBeenCalledWith(path.resolve("/wt", "repo", ".agent-roster"));
  });

  it("reads no requests from a directory nobody has written to", async () => {
    const directory = await messageDirectory();

    expect(await readStopRequests({ directory, instanceId: INSTANCE, roster: new Map(), now: SENT_AT, seen: new Set() })).toEqual([]);
    expect(await readUnopenedRequests(directory, new Map())).toEqual([]);
  });
});

// a-run-is-told-where-to-stop 1.4: the task travels in the request, and a
// task nobody can read never reaches a run.
describe("a stop that names a task to stop after", () => {
  it("seals the task and reads it back", async () => {
    const directory = await messageDirectory();
    const key = memoryKey();
    await askRunToStop({
      directory, to: INSTANCE, reason: "only up to 4.6", afterTask: "4.6",
      key, machine: "machine-a", now: () => SENT_AT,
    });

    const readings = await readStopRequests({ directory, instanceId: INSTANCE, roster: rosterWith(key), now: SENT_AT, seen: new Set() });

    expect(readings).toEqual([
      expect.objectContaining({
        state: "act",
        message: expect.objectContaining({ reason: "only up to 4.6", afterTask: "4.6" }),
      }),
    ]);
  });

  it("reads a request without one exactly as before", async () => {
    const directory = await messageDirectory();
    const key = memoryKey();
    await asked(directory, key);

    const [reading] = await readStopRequests({ directory, instanceId: INSTANCE, roster: rosterWith(key), now: SENT_AT, seen: new Set() });

    expect(reading?.state).toBe("act");
    expect(reading?.message.afterTask).toBeUndefined();
  });

  it("refuses to write a task that is not a task number", async () => {
    const directory = await messageDirectory();
    const key = memoryKey();

    await expect(askRunToStop({
      directory, to: INSTANCE, reason: "no", afterTask: "the fourth one",
      key, machine: "machine-a", now: () => SENT_AT,
    })).rejects.toThrow("is not a task number");
  });

  it("does not read a signed request whose task is not a task number", async () => {
    // Signed by an enrolled key and still unreadable: the envelope proves
    // who wrote it, never that what they wrote can be honoured.
    const directory = await messageDirectory();
    const key = memoryKey();
    const messageId = await asked(directory, key);
    const file = path.join(directory, `${messageId}.json`);
    const envelope = JSON.parse(await readFile(file, "utf8")) as { payload: string };
    const payload = JSON.parse(Buffer.from(envelope.payload, "base64").toString("utf8")) as Record<string, unknown>;
    payload.afterTask = "later";
    const { sealEnvelope } = await import("./signed-envelope.js");
    await writeFile(file, `${JSON.stringify(sealEnvelope(Buffer.from(JSON.stringify(payload), "utf8"), key), null, 2)}
`, "utf8");

    const readings = await readStopRequests({ directory, instanceId: INSTANCE, roster: rosterWith(key), now: SENT_AT, seen: new Set() });

    expect(readings).toEqual([]);
  });
});
