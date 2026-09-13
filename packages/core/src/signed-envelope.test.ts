import { generateKeyPairSync, sign } from "node:crypto";
import { describe, expect, it } from "vitest";
import { keyIdOf, type MachineKey } from "./machine-key.js";
import { openEnvelope, sealEnvelope, type Roster, type SignedEnvelope } from "./signed-envelope.js";

/** A key made in memory: the envelope needs nothing from disk. */
function memoryKey(): MachineKey {
  const { privateKey, publicKey } = generateKeyPairSync("ed25519");
  return {
    keyId: keyIdOf(publicKey),
    publicKeyPem: publicKey.export({ type: "spki", format: "pem" }).toString(),
    publicKey: publicKey.export({ type: "spki", format: "der" }).toString("base64"),
    sign: (bytes) => new Uint8Array(sign(null, bytes, privateKey)),
  };
}

function enrolled(key: MachineKey, publicKey = key.publicKey): Roster {
  return new Map([[key.keyId, { keyId: key.keyId, publicKey, label: "Ada", gitAuthor: "ada@example.com" }]]);
}

const BYTES = new TextEncoder().encode(JSON.stringify({ version: 1, activity: "Bash: npm test" }));

function text(envelope: SignedEnvelope): string {
  return JSON.stringify(envelope);
}

describe("sealEnvelope and openEnvelope (a-run-is-signed-by-its-person 2.2)", () => {
  it("reads a sealed envelope from an enrolled key as verified, with its person and its exact bytes", () => {
    const key = memoryKey();

    const opened = openEnvelope(text(sealEnvelope(BYTES, key)), enrolled(key));

    expect(opened).toMatchObject({ state: "verified", person: { keyId: key.keyId, label: "Ada", gitAuthor: "ada@example.com" } });
    if (opened.state === "verified") expect(Buffer.from(opened.bytes).equals(Buffer.from(BYTES))).toBe(true);
  });

  it("reads the same envelope from a key not enrolled as unverified, naming the key", () => {
    const key = memoryKey();

    const opened = openEnvelope(text(sealEnvelope(BYTES, key)), new Map());

    expect(opened).toMatchObject({ state: "unverified", signer: { keyId: key.keyId, publicKey: key.publicKey } });
  });

  it("does not check out when one payload byte is changed", () => {
    const key = memoryKey();
    const envelope = sealEnvelope(BYTES, key);
    const bytes = Buffer.from(envelope.payload, "base64");
    bytes[0] = (bytes[0] as number) ^ 1;

    const opened = openEnvelope(text({ ...envelope, payload: bytes.toString("base64") }), enrolled(key));

    expect(opened).toMatchObject({ state: "does-not-check-out" });
  });

  it("does not check out when the key id does not match the key", () => {
    const key = memoryKey();
    const other = memoryKey();

    const opened = openEnvelope(text({ ...sealEnvelope(BYTES, key), keyId: other.keyId }), enrolled(key));

    expect(opened).toEqual({ state: "does-not-check-out", why: "its key id does not match its key" });
  });

  it("does not check out when the roster holds that key id with a different key", () => {
    const key = memoryKey();
    const other = memoryKey();

    const opened = openEnvelope(text(sealEnvelope(BYTES, key)), enrolled(key, other.publicKey));

    expect(opened).toEqual({ state: "does-not-check-out", why: "a different key is enrolled under its key id" });
  });

  it("does not check out when the payload is not base64", () => {
    const key = memoryKey();

    const opened = openEnvelope(text({ ...sealEnvelope(BYTES, key), payload: "not base64!" }), enrolled(key));

    expect(opened).toEqual({ state: "does-not-check-out", why: "its payload is not base64" });
  });
});
