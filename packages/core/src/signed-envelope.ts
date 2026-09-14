// The bytes are what is signed — ADR 0028.
//
// A signed record is an envelope around the exact bytes of its document. A
// reader checks the key, verifies the signature over those bytes, and only
// then hands the bytes on to be parsed. Nothing here parses the payload:
// a signature over a canonical form would cover something other than what
// is read.

import { createPublicKey, verify, type KeyObject } from "node:crypto";
import { keyIdOf, type MachineKey } from "./machine-key.js";
import type { EnrolledPerson } from "./signature-facts.js";

export const SIGNED_ENVELOPE_VERSION = 2;

export interface SignedEnvelope {
  version: typeof SIGNED_ENVELOPE_VERSION;
  keyId: string;
  /** Base64 of the signing key's SPKI DER encoding. */
  publicKey: string;
  /** Base64 of the Ed25519 signature over the payload's bytes. */
  signature: string;
  /** Base64 of the signed bytes. */
  payload: string;
}

/** A key as the roster holds it. */
export interface RosterKey extends EnrolledPerson {
  publicKey: string;
}

/** The enrolled keys, by key id. */
export type Roster = ReadonlyMap<string, RosterKey>;

/** The key that signed an envelope, where its signature verified. */
export interface EnvelopeSigner {
  keyId: string;
  publicKey: string;
}

export type OpenedEnvelope =
  | { state: "verified"; bytes: Uint8Array; person: EnrolledPerson; signer: EnvelopeSigner }
  | { state: "unverified"; bytes: Uint8Array; signer: EnvelopeSigner }
  | { state: "does-not-check-out"; why: string };

const BASE64 = /^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/u;

function decodeBase64(value: unknown): Buffer | undefined {
  if (typeof value !== "string" || !BASE64.test(value)) return undefined;
  return Buffer.from(value, "base64");
}

/** An Ed25519 public key from its base64 DER, or `undefined`. */
export function publicKeyFromBase64(value: unknown): KeyObject | undefined {
  const der = decodeBase64(value);
  if (der === undefined || der.length === 0) return undefined;
  try {
    const key = createPublicKey({ key: der, format: "der", type: "spki" });
    return key.asymmetricKeyType === "ed25519" ? key : undefined;
  } catch {
    return undefined;
  }
}

/** Whether `publicKey` (base64 DER) is an Ed25519 key whose id is `keyId`. */
export function keyMatchesKeyId(publicKey: unknown, keyId: unknown): boolean {
  const key = publicKeyFromBase64(publicKey);
  return key !== undefined && typeof keyId === "string" && keyIdOf(key) === keyId;
}

/** Whether a parsed JSON value claims to be an envelope. */
export function isSignedEnvelope(value: unknown): boolean {
  return typeof value === "object" && value !== null && (value as { version?: unknown }).version === SIGNED_ENVELOPE_VERSION;
}

/** `bytes`, sealed by `key`. */
export function sealEnvelope(bytes: Uint8Array, key: Pick<MachineKey, "keyId" | "publicKey" | "sign">): SignedEnvelope {
  return {
    version: SIGNED_ENVELOPE_VERSION,
    keyId: key.keyId,
    publicKey: key.publicKey,
    signature: Buffer.from(key.sign(bytes)).toString("base64"),
    payload: Buffer.from(bytes).toString("base64"),
  };
}

/** The bytes inside an envelope, once its key and signature check out, with
 * how far the signature shows whose they are. */
export function openEnvelope(text: string, roster: Roster): OpenedEnvelope {
  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch {
    return { state: "does-not-check-out", why: "not valid JSON" };
  }
  if (!isSignedEnvelope(parsed)) return { state: "does-not-check-out", why: "not a signed envelope" };
  const envelope = parsed as Record<string, unknown>;

  const key = publicKeyFromBase64(envelope.publicKey);
  if (key === undefined) return { state: "does-not-check-out", why: "its public key is not an Ed25519 key" };
  if (typeof envelope.keyId !== "string" || keyIdOf(key) !== envelope.keyId) {
    return { state: "does-not-check-out", why: "its key id does not match its key" };
  }
  const bytes = decodeBase64(envelope.payload);
  if (bytes === undefined) return { state: "does-not-check-out", why: "its payload is not base64" };
  const signature = decodeBase64(envelope.signature);
  if (signature === undefined) return { state: "does-not-check-out", why: "its signature is not base64" };

  let valid = false;
  try {
    valid = verify(null, bytes, key, signature);
  } catch {
    valid = false;
  }
  if (!valid) return { state: "does-not-check-out", why: "its signature does not verify over its payload" };

  const signer = { keyId: envelope.keyId, publicKey: envelope.publicKey as string };
  const enrolled = roster.get(envelope.keyId);
  if (enrolled === undefined) return { state: "unverified", bytes: new Uint8Array(bytes), signer };
  if (enrolled.publicKey !== signer.publicKey) {
    return { state: "does-not-check-out", why: "a different key is enrolled under its key id" };
  }
  const person: EnrolledPerson = {
    keyId: enrolled.keyId,
    label: enrolled.label,
    ...(enrolled.gitAuthor !== undefined ? { gitAuthor: enrolled.gitAuthor } : {}),
  };
  return { state: "verified", bytes: new Uint8Array(bytes), person, signer };
}
