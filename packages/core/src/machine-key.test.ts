import { createPublicKey, verify } from "node:crypto";
import { mkdir, mkdtemp, readFile, rm, stat, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";
import { loadOrCreateMachineKey, machineKeyDirectory } from "./machine-key.js";

// every-varying-check-has-a-budget: an Ed25519 pair and a few small files in
// a temporary home. No git, no agent.
vi.setConfig({ testTimeout: 15_000 });

const homes: string[] = [];

async function temporaryHome(): Promise<string> {
  const home = await mkdtemp(path.join(os.tmpdir(), "openspec-machine-key-"));
  homes.push(home);
  return home;
}

afterEach(async () => {
  await Promise.all(homes.splice(0).map((home) => rm(home, { recursive: true, force: true })));
});

describe("loadOrCreateMachineKey (a-run-is-signed-by-its-person 1.3)", () => {
  it("creates a key once, in the person's identity directory, and reads it back", async () => {
    const homeDir = await temporaryHome();

    const made = await loadOrCreateMachineKey({ homeDir });
    const privatePem = await readFile(path.join(machineKeyDirectory(homeDir), "ed25519.pem"), "utf8");
    const read = await loadOrCreateMachineKey({ homeDir });

    expect(read.publicKeyPem).toBe(made.publicKeyPem);
    expect(await readFile(path.join(machineKeyDirectory(homeDir), "ed25519.pem"), "utf8")).toBe(privatePem);
    expect(await readFile(path.join(machineKeyDirectory(homeDir), "ed25519.pub.pem"), "utf8")).toBe(made.publicKeyPem);
    if (process.platform !== "win32") {
      // Where the platform honours a mode, only the owner reads the key.
      expect((await stat(path.join(machineKeyDirectory(homeDir), "ed25519.pem"))).mode & 0o777).toBe(0o600);
    }
  });

  it("keeps one key id across reads, the digest of the public key", async () => {
    const homeDir = await temporaryHome();

    const first = await loadOrCreateMachineKey({ homeDir });
    const second = await loadOrCreateMachineKey({ homeDir });

    expect(first.keyId).toMatch(/^[0-9a-f]{32}$/u);
    expect(second.keyId).toBe(first.keyId);
  });

  it("signs bytes that verify with its public key", async () => {
    const homeDir = await temporaryHome();
    const key = await loadOrCreateMachineKey({ homeDir });
    const bytes = new TextEncoder().encode("a run's record");

    const signature = key.sign(bytes);

    expect(verify(null, bytes, createPublicKey(key.publicKeyPem), signature)).toBe(true);
  });

  it("makes one key when two first calls race", async () => {
    const homeDir = await temporaryHome();

    const [one, two, three] = await Promise.all([
      loadOrCreateMachineKey({ homeDir }),
      loadOrCreateMachineKey({ homeDir }),
      loadOrCreateMachineKey({ homeDir }),
    ]);

    expect(two.keyId).toBe(one.keyId);
    expect(three.keyId).toBe(one.keyId);
    expect((await loadOrCreateMachineKey({ homeDir })).keyId).toBe(one.keyId);
  });

  it("rejects with a catchable error where the private file cannot be read as a key", async () => {
    const homeDir = await temporaryHome();
    await mkdir(machineKeyDirectory(homeDir), { recursive: true });
    await writeFile(path.join(machineKeyDirectory(homeDir), "ed25519.pem"), "not a key", "utf8");

    await expect(loadOrCreateMachineKey({ homeDir })).rejects.toBeInstanceOf(Error);
  });
});
