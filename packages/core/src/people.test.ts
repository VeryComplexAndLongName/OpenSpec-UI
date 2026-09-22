import { generateKeyPairSync, sign } from "node:crypto";
import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";
import { keyIdOf, type MachineKey } from "./machine-key.js";
import {
  comparePeople,
  crossCheckPeople,
  joinTheTeam,
  JoinRefusedError,
  parsePersonFile,
  peopleRoster,
  readPeople,
  readPeopleAt,
  type Person,
} from "./people.js";
import { openEnvelope, sealEnvelope } from "./signed-envelope.js";

// a-team-works-through-git, ADR 0037 decision 2: people are in git.
//
// every-varying-check-has-a-budget: Ed25519 keys are generated and small
// files written to temporary directories. Measured on 2026-09-22: the
// twelve together take 100 ms; the budget leaves room for a loaded machine.
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

function personWith(handle: string, ...keys: MachineKey[]): Person {
  return { handle, name: handle.toUpperCase(), keys: keys.map((key) => ({ keyId: key.keyId, publicKey: key.publicKey, addedAt: "2026-09-22" })) };
}

const roots: string[] = [];
afterEach(async () => {
  await Promise.all(roots.splice(0).map((root) => rm(root, { recursive: true, force: true })));
});

async function repository(): Promise<string> {
  const root = await mkdtemp(path.join(os.tmpdir(), "openspec-people-"));
  roots.push(root);
  return root;
}

describe("a person's file", () => {
  it("reads a person with their keys, and checks the file is named after the handle", () => {
    const key = memoryKey();
    const text = JSON.stringify(personWith("ada", key));

    expect(parsePersonFile("ada.json", text)).toEqual({ person: personWith("ada", key) });
    expect(parsePersonFile("bob.json", text)).toEqual({ problems: ["its file is not named after its handle (ada.json)"] });
  });

  it("says what is wrong with a file that is not a person", () => {
    const key = memoryKey();
    const wrong = { handle: "Ada Lovelace", name: "", keys: [{ keyId: "0".repeat(32), publicKey: key.publicKey, addedAt: "yesterday" }] };

    const read = parsePersonFile("x.json", JSON.stringify(wrong));

    expect("problems" in read && read.problems).toEqual([
      "its handle is missing or not lower-case letters, digits and single hyphens",
      "it has no name",
      "key 1 is not an Ed25519 public key with its key id",
    ]);
  });

  it("finds one key in two people's files", () => {
    const shared = memoryKey();

    expect(crossCheckPeople([personWith("ada", shared), personWith("bob", shared)])).toEqual([
      { file: "openspec/people/bob.json", problem: `key ${shared.keyId} is also ada's` },
    ]);
  });
});

describe("the people as a roster", () => {
  it("verifies what a person's key signed, naming them by name and handle", () => {
    const key = memoryKey();
    const envelope = JSON.stringify(sealEnvelope(new TextEncoder().encode("{}"), key));

    const opened = openEnvelope(envelope, peopleRoster([personWith("ada", key)]));

    expect(opened).toMatchObject({ state: "verified", person: { keyId: key.keyId, label: "ADA", handle: "ada" } });
  });
});

describe("what a pull request may do to the people", () => {
  it("allows a new person, a new key and a retirement", () => {
    const first = memoryKey();
    const second = memoryKey();
    const base = [personWith("ada", first)];
    const head = [
      { ...personWith("ada", first, second), keys: [{ ...personWith("ada", first).keys[0]!, retiredAt: "2026-09-23" }, personWith("ada", second).keys[0]!] },
      personWith("bob", memoryKey()),
    ];

    expect(comparePeople(base, head)).toEqual([]);
  });

  it("refuses a person or a key taken out, a key replaced, and a retirement changed", () => {
    const first = memoryKey();
    const second = memoryKey();
    const base = [
      { ...personWith("ada", first, second), keys: [personWith("ada", first).keys[0]!, { ...personWith("ada", second).keys[0]!, retiredAt: "2026-09-01" }] },
      personWith("bob", memoryKey()),
    ];
    const head = [{ ...personWith("ada", second), keys: [{ ...personWith("ada", second).keys[0]!, retiredAt: "2026-09-02" }] }];

    expect(comparePeople(base, head).map((one) => one.problem)).toEqual([
      `key ${first.keyId} was removed; retire it with retiredAt instead`,
      `key ${second.keyId}'s retirement was changed`,
      "a person is never removed: their signatures would stop verifying",
    ]);
  });
});

describe("joining the team", () => {
  it("writes a new person's file with this machine's key, and nothing else", async () => {
    const root = await repository();
    const key = memoryKey();

    const joined = await joinTheTeam(root, { handle: "ada", name: "Ada Lovelace", key, machine: "laptop", now: () => new Date("2026-09-22T10:00:00Z") });

    expect(joined.outcome).toBe("joined");
    expect(JSON.parse(await readFile(path.join(root, "openspec", "people", "ada.json"), "utf8"))).toEqual({
      handle: "ada",
      name: "Ada Lovelace",
      keys: [{ keyId: key.keyId, publicKey: key.publicKey, machine: "laptop", addedAt: "2026-09-22" }],
    });
    expect((await readPeople(root)).problems).toEqual([]);
  });

  it("adds a second machine's key to the file, and says so once it is there", async () => {
    const root = await repository();
    const laptop = memoryKey();
    const desktop = memoryKey();
    await joinTheTeam(root, { handle: "ada", name: "Ada", key: laptop, machine: "laptop" });

    expect((await joinTheTeam(root, { handle: "ada", name: "Ada", key: desktop, machine: "desktop" })).outcome).toBe("key-added");
    expect((await joinTheTeam(root, { handle: "ada", name: "Ada", key: desktop, machine: "desktop" })).outcome).toBe("already");
    expect((await readPeople(root)).people[0]?.keys.map((one) => one.machine)).toEqual(["laptop", "desktop"]);
  });

  it("refuses a key that is already somebody else's, and a handle that is not one", async () => {
    const root = await repository();
    const key = memoryKey();
    await joinTheTeam(root, { handle: "ada", name: "Ada", key });

    await expect(joinTheTeam(root, { handle: "bob", name: "Bob", key })).rejects.toThrow(JoinRefusedError);
    await expect(joinTheTeam(root, { handle: "Bob Smith", name: "Bob", key: memoryKey() })).rejects.toThrow("is not a handle");
  });
});

describe("reading the people", () => {
  it("reads no directory as no people, and a broken file as a problem beside the rest", async () => {
    const root = await repository();
    expect(await readPeople(root)).toEqual({ people: [], problems: [] });

    await mkdir(path.join(root, "openspec", "people"), { recursive: true });
    await writeFile(path.join(root, "openspec", "people", "ada.json"), JSON.stringify(personWith("ada", memoryKey())), "utf8");
    await writeFile(path.join(root, "openspec", "people", "bad.json"), "{", "utf8");

    const read = await readPeople(root);
    expect(read.people.map((one) => one.handle)).toEqual(["ada"]);
    expect(read.problems).toEqual([{ file: "openspec/people/bad.json", problem: "it is not valid JSON" }]);
  });

  it("reads the people at a ref through git", async () => {
    const person = personWith("ada", memoryKey());
    const git = {
      listTreeNames: async () => ["ada.json", "README.md"],
      showFile: async (_ref: string, file: string) => (file.endsWith("ada.json") ? JSON.stringify(person) : undefined),
    };

    expect((await readPeopleAt(git, "origin/main")).people).toEqual([person]);
  });
});
