import { generateKeyPairSync, sign } from "node:crypto";
import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  agentRosterDirectory,
  collectEnrolmentRequests,
  confirmEnrolment,
  EnrolmentRefusedError,
  readAgentRoster,
  rosterOf,
} from "./agent-roster.js";
import { agentStatusDirectory, AgentStatusWriter, readAgentStatuses } from "./agent-status.js";
import { keyIdOf, type MachineKey } from "./machine-key.js";

// every-varying-check-has-a-budget: small file writes in a temporary
// directory and in-memory Ed25519 keys. No git, no agent.
vi.setConfig({ testTimeout: 15_000 });

const roots: string[] = [];

async function temporaryRoot(): Promise<string> {
  const root = await mkdtemp(path.join(os.tmpdir(), "openspec-roster-"));
  roots.push(root);
  return root;
}

afterEach(async () => {
  await Promise.all(roots.splice(0).map((root) => rm(root, { recursive: true, force: true })));
});

function memoryKey(): MachineKey {
  const { privateKey, publicKey } = generateKeyPairSync("ed25519");
  return {
    keyId: keyIdOf(publicKey),
    publicKeyPem: publicKey.export({ type: "spki", format: "pem" }).toString(),
    publicKey: publicKey.export({ type: "spki", format: "der" }).toString("base64"),
    sign: (bytes) => new Uint8Array(sign(null, bytes, privateKey)),
  };
}

/** A repository's status directory and roster directory, side by side, and a
 * working directory a run reports from. */
async function layout() {
  const root = await temporaryRoot();
  const repository = path.join(root, "repo");
  const worktreeRoot = path.join(root, "wt-root");
  return {
    statusDirectory: agentStatusDirectory(worktreeRoot, repository),
    rosterDirectory: agentRosterDirectory(worktreeRoot, repository),
    workingDirectory: path.join(worktreeRoot, "repo", "alpha"),
  };
}

async function signedRun(statusDirectory: string, workingDirectory: string, key: MachineKey, instanceId = "run-1") {
  const writer = new AgentStatusWriter({
    directory: statusDirectory,
    workingDirectory,
    changeName: "alpha",
    instanceId,
    key,
    gitAuthor: "ada@example.com",
    machine: "ada-laptop",
  });
  await writer.start("applying");
  return writer;
}

describe("readAgentRoster (a-run-is-signed-by-its-person 4.5)", () => {
  it("does not trust a file whose name is not its key id", async () => {
    const { rosterDirectory } = await layout();
    const key = memoryKey();
    await mkdir(rosterDirectory, { recursive: true });
    await writeFile(
      path.join(rosterDirectory, "someone.json"),
      JSON.stringify({ keyId: key.keyId, publicKey: key.publicKey, label: "Ada", machine: "m", confirmedAt: "2026-09-14T00:00:00.000Z" }),
      "utf8",
    );

    const roster = await readAgentRoster(rosterDirectory);

    expect(roster.entries).toEqual([]);
    expect(roster.malformed).toEqual([{ fileName: "someone.json", reason: `its file name does not match its key id "${key.keyId}"` }]);
  });

  it("does not trust a file whose key does not match its key id", async () => {
    const { rosterDirectory } = await layout();
    const key = memoryKey();
    const other = memoryKey();
    await mkdir(rosterDirectory, { recursive: true });
    await writeFile(
      path.join(rosterDirectory, `${key.keyId}.json`),
      JSON.stringify({ keyId: key.keyId, publicKey: other.publicKey, label: "Ada", machine: "m", confirmedAt: "2026-09-14T00:00:00.000Z" }),
      "utf8",
    );

    const roster = await readAgentRoster(rosterDirectory);

    expect(roster.entries).toEqual([]);
    expect(roster.malformed[0]?.reason).toBe("its key does not match its key id");
  });
});

describe("enrolment (a-run-is-signed-by-its-person 4.5)", () => {
  it("asks once for a key that signs live records and is not enrolled", async () => {
    const { statusDirectory, workingDirectory } = await layout();
    const key = memoryKey();
    const first = await signedRun(statusDirectory, workingDirectory, key, "run-1");
    const second = await signedRun(statusDirectory, workingDirectory, key, "run-2");

    const { reports } = await readAgentStatuses(statusDirectory);
    const requests = collectEnrolmentRequests({ statuses: reports, roster: new Map() });

    expect(reports.map((report) => report.signature)).toEqual(["unverified", "unverified"]);
    expect(requests).toEqual([
      expect.objectContaining({
        keyId: key.keyId,
        publicKey: key.publicKey,
        label: "alpha",
        workingDirectory,
        machine: "ada-laptop",
        gitAuthor: "ada@example.com",
      }),
    ]);
    await first.stop();
    await second.stop();
  });

  it("enrols the key on confirmation, after which its records read as verified and nothing more is asked", async () => {
    const { statusDirectory, rosterDirectory, workingDirectory } = await layout();
    const key = memoryKey();
    const writer = await signedRun(statusDirectory, workingDirectory, key);
    const before = await readAgentStatuses(statusDirectory);
    const [request] = collectEnrolmentRequests({ statuses: before.reports, roster: new Map() });

    const entry = await confirmEnrolment({ rosterDirectory, request: request!, now: () => new Date("2026-09-14T00:00:00.000Z") });
    const roster = await readAgentRoster(rosterDirectory);
    await writer.reportActivity("verifying");
    const after = await readAgentStatuses(statusDirectory);

    // The label defaults to the git author.
    expect(entry).toMatchObject({ keyId: key.keyId, label: "ada@example.com", machine: "ada-laptop" });
    expect(roster.entries).toEqual([entry]);
    expect(after.reports[0]).toMatchObject({
      signature: "verified",
      person: { keyId: key.keyId, label: "ada@example.com", gitAuthor: "ada@example.com" },
      activity: "verifying",
    });
    expect(collectEnrolmentRequests({ statuses: after.reports, roster: rosterOf(roster.entries) })).toEqual([]);
    await writer.stop();
  });

  it("refuses to confirm a key id already enrolled with a different key", async () => {
    const { rosterDirectory } = await layout();
    const key = memoryKey();
    const other = memoryKey();
    await mkdir(rosterDirectory, { recursive: true });
    await writeFile(
      path.join(rosterDirectory, `${key.keyId}.json`),
      JSON.stringify({ keyId: key.keyId, publicKey: other.publicKey, label: "Mallory", machine: "m", confirmedAt: "2026-09-14T00:00:00.000Z" }),
      "utf8",
    );
    const request = { keyId: key.keyId, publicKey: key.publicKey, label: "alpha", machine: "ada-laptop", gitAuthor: null };

    await expect(confirmEnrolment({ rosterDirectory, request })).rejects.toBeInstanceOf(EnrolmentRefusedError);
    await expect(confirmEnrolment({ rosterDirectory, request: { ...request, publicKey: other.publicKey } }))
      .rejects.toBeInstanceOf(EnrolmentRefusedError);
  });
});
