import { generateKeyPairSync, sign } from "node:crypto";
import { mkdtemp, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";
import { EnrolmentRefusedError } from "./agent-roster.js";
import { agentStatusDirectory, AgentStatusWriter, readAgentStatuses } from "./agent-status.js";
import { confirmEnrolmentFor, readEnrolmentRequests } from "./enrolment.js";
import { keyIdOf, type MachineKey } from "./machine-key.js";

// every-varying-check-has-a-budget: small file writes in a temporary
// directory, an in-memory key and a fake git. No subprocess.
vi.setConfig({ testTimeout: 15_000 });

const roots: string[] = [];

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

async function workspace() {
  const root = await mkdtemp(path.join(os.tmpdir(), "openspec-enrolment-"));
  roots.push(root);
  const repository = path.join(root, "repo");
  const worktreeRoot = path.join(root, "wt-root");
  return {
    repository,
    statusDirectory: agentStatusDirectory(worktreeRoot, repository),
    options: {
      git: { worktreeList: async () => [{ path: repository }] },
      rootSources: { env: { OPENSPEC_UI_WORKTREE_ROOT: worktreeRoot } },
    },
  };
}

describe("readEnrolmentRequests and confirmEnrolmentFor (a-run-is-signed-by-its-person)", () => {
  it("lists a key waiting to be enrolled, enrols it by its key id, and lists it no more", async () => {
    const { repository, statusDirectory, options } = await workspace();
    const key = memoryKey();
    const writer = new AgentStatusWriter({ directory: statusDirectory, workingDirectory: repository, key, machine: "ada-laptop" });
    await writer.start("applying");

    const before = await readEnrolmentRequests(repository, options);
    const entry = await confirmEnrolmentFor(repository, key.keyId, { ...options, label: "Ada" });
    const after = await readEnrolmentRequests(repository, options);

    expect(before.requests.map((request) => request.keyId)).toEqual([key.keyId]);
    expect(entry).toMatchObject({ keyId: key.keyId, label: "Ada", machine: "ada-laptop" });
    expect(after.requests).toEqual([]);
    expect((await readAgentStatuses(statusDirectory)).reports[0]).toMatchObject({ signature: "verified", person: { label: "Ada" } });
    await writer.stop();
  });

  it("refuses a key id no live run is signing", async () => {
    const { repository, options } = await workspace();

    await expect(confirmEnrolmentFor(repository, "0".repeat(32), options)).rejects.toBeInstanceOf(EnrolmentRefusedError);
  });
});
