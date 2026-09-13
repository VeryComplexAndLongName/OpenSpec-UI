// A key per person, per machine — ADR 0028, "A key belongs to a person, on
// a machine" and "Ed25519 from the runtime".
//
// Made the first time it is needed, kept in the person's own configuration
// directory, with no passphrase: an unattended run has nobody to type one,
// and the file's permissions are its protection.

import { createHash, createPrivateKey, createPublicKey, generateKeyPairSync, randomUUID, sign, type KeyObject } from "node:crypto";
import { link, mkdir, readFile, rename, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";

const PRIVATE_FILE = "ed25519.pem";
const PUBLIC_FILE = "ed25519.pub.pem";

export interface MachineKey {
  /** The first 32 hex characters of the SHA-256 of the public key's DER. */
  keyId: string;
  publicKeyPem: string;
  /** Base64 of the public key's SPKI DER encoding: how an envelope and a
   * roster entry carry it. */
  publicKey: string;
  sign(bytes: Uint8Array): Uint8Array;
}

export interface MachineKeyOptions {
  /** The person's home directory. Defaults to the operating system's. */
  homeDir?: string;
}

/** Where the key lives, beside the person's other settings. */
export function machineKeyDirectory(homeDir: string = os.homedir()): string {
  return path.join(homeDir, ".openspec-ui", "identity");
}

/** The key id of an Ed25519 public key. */
export function keyIdOf(publicKey: KeyObject): string {
  const der = publicKey.export({ type: "spki", format: "der" });
  return createHash("sha256").update(der).digest("hex").slice(0, 32);
}

function errorCode(error: unknown): string | undefined {
  return error instanceof Error && "code" in error ? (error as NodeJS.ErrnoException).code : undefined;
}

function toMachineKey(privateKey: KeyObject, file: string): MachineKey {
  if (privateKey.asymmetricKeyType !== "ed25519") {
    throw new Error(`the key at ${file} is not an Ed25519 key`);
  }
  const publicKey = createPublicKey(privateKey);
  return {
    keyId: keyIdOf(publicKey),
    publicKeyPem: publicKey.export({ type: "spki", format: "pem" }).toString(),
    publicKey: publicKey.export({ type: "spki", format: "der" }).toString("base64"),
    sign: (bytes) => new Uint8Array(sign(null, bytes, privateKey)),
  };
}

/** The private key in `file`, or `undefined` where there is no file yet. A
 * file that exists and cannot be read or parsed rejects. */
async function readPrivateKey(file: string): Promise<KeyObject | undefined> {
  let pem: string;
  try {
    pem = await readFile(file, "utf8");
  } catch (error) {
    if (errorCode(error) === "ENOENT") return undefined;
    throw error;
  }
  return createPrivateKey(pem);
}

/** Puts `temporary` at `target` only where nothing is there yet.
 *
 * A hard link is created atomically and fails where the name is taken, so
 * two calls that make a key at once leave exactly one. A filesystem with no
 * hard links gets an exclusive create instead. */
async function placeExclusively(temporary: string, target: string, contents: string): Promise<void> {
  try {
    await link(temporary, target);
    return;
  } catch (error) {
    if (errorCode(error) === "EEXIST") return;
  }
  try {
    await writeFile(target, contents, { encoding: "utf8", mode: 0o600, flag: "wx" });
  } catch (error) {
    if (errorCode(error) !== "EEXIST") throw error;
  }
}

/** Writes the public file where it is missing or says something else. It is
 * derived from the private key, so every writer writes the same bytes. */
async function writePublicFile(file: string, pem: string): Promise<void> {
  const current = await readFile(file, "utf8").catch(() => undefined);
  if (current === pem) return;
  const temporary = `${file}.${randomUUID()}.tmp`;
  try {
    await writeFile(temporary, pem, "utf8");
    await rename(temporary, file);
  } catch (error) {
    // Windows refuses a rename onto a name another writer holds open. Every
    // writer writes the same bytes, so another's file standing there is the
    // file this one meant to write.
    if ((await readFile(file, "utf8").catch(() => undefined)) !== pem) throw error;
  } finally {
    await rm(temporary, { force: true }).catch(() => undefined);
  }
}

/** The person's key for this machine, made on first need.
 *
 * Every call signs with the private key on disk once it has placed its own
 * or found another's there, so two runs that start together sign with one
 * key. A private file that cannot be read rejects: the caller decides what
 * a run without a key does (it writes unsigned, ADR 0028). */
export async function loadOrCreateMachineKey(options: MachineKeyOptions = {}): Promise<MachineKey> {
  const directory = machineKeyDirectory(options.homeDir);
  const privateFile = path.join(directory, PRIVATE_FILE);

  let privateKey = await readPrivateKey(privateFile);
  if (privateKey === undefined) {
    await mkdir(directory, { recursive: true });
    const made = generateKeyPairSync("ed25519").privateKey.export({ type: "pkcs8", format: "pem" }).toString();
    const temporary = `${privateFile}.${randomUUID()}.tmp`;
    try {
      await writeFile(temporary, made, { encoding: "utf8", mode: 0o600 });
      await placeExclusively(temporary, privateFile, made);
    } finally {
      await rm(temporary, { force: true }).catch(() => undefined);
    }
    privateKey = await readPrivateKey(privateFile);
    if (privateKey === undefined) throw new Error(`the key at ${privateFile} was removed as it was made`);
  }

  const key = toMachineKey(privateKey, privateFile);
  await writePublicFile(path.join(directory, PUBLIC_FILE), key.publicKeyPem);
  return key;
}
