// A bounded transport worker. Homepage owns the durable publication lifecycle.
import { createHash, createPrivateKey, randomUUID, sign, X509Certificate } from "node:crypto";
import { readFileSync } from "node:fs";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { execFileSync, spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { verifyReceipt } from "./publication-receipt.mjs";
import { assertionFromCertificate, identity as entraIdentity, probeEntra } from "./check-marketplace-entra-access.mjs";

const ORIGIN = "https://openspec-ui.dev";
const REPO = "VeryComplexAndLongName/OpenSpec-UI";
const ITEM = "openspec-ui.openspec-ui-vscode";
const WORKER_RUN = randomUUID();

export function validateJob(job, channel) {
  if (!job || !Number.isSafeInteger(job.id) || job.id < 1 || job.channel !== channel ||
      !/^\d+\.\d+\.\d+$/u.test(job.version) || !/^[\w-]{20,64}$/u.test(job.lease) ||
      !/^[a-f0-9]{64}$/u.test(job.sha256) || !/^[a-f0-9]{40}$/u.test(job.commit)) {
    throw new Error("Invalid approved publication job");
  }
  const url = new URL(job.artifact_url);
  const tag = `${channel === "npm" ? "openspec-ui-cli" : "openspec-ui-vscode"}@${job.version}`;
  const prefix = `/${REPO}/releases/download/${tag}/`;
  const pathname = decodeURIComponent(url.pathname);
  const filename = pathname.slice(prefix.length);
  const suffix = channel === "npm" ? ".tgz" : ".vsix";
  if (url.origin !== "https://github.com" || url.search || url.hash ||
      !pathname.startsWith(prefix) || filename.includes("/") ||
      !filename.endsWith(`${job.version}${suffix}`)) throw new Error("Untrusted release asset URL");
  return filename;
}

export async function request(url, options = {}, fetcher = fetch) {
  const response = await fetcher(url, { ...options, signal: AbortSignal.timeout(45_000) });
  if (!response.ok) throw new Error(`HTTP ${response.status} from ${new URL(url).hostname}`);
  return response;
}

export async function identity(audience, env = process.env, invoke = execFileSync) {
  if (![`${ORIGIN}/api/publications`, "npm:registry.npmjs.org"].includes(audience)) throw new Error("Unapproved identity audience");
  if (env.CIRCLECI === "true") {
    if (env.CIRCLE_BRANCH !== "main") throw new Error("Only CircleCI main may publish");
    let token;
    try {
      token = invoke("circleci", ["run", "oidc", "get", "--v2", "--aud", audience],
        { encoding: "utf8", stdio: ["ignore", "pipe", "pipe"], timeout: 30_000 }).trim();
    } catch { throw new Error("CircleCI could not issue the requested identity (details withheld)"); }
    if (!token) throw new Error("No CircleCI identity returned");
    return token;
  }
  if (!env.OPENSPEC_MARKETPLACE_CERTIFICATE || audience !== `${ORIGIN}/api/publications`) {
    throw new Error("Approved CircleCI or certificate identity is required");
  }
  let pem, certificate, key;
  try {
    pem = readFileSync(env.OPENSPEC_MARKETPLACE_CERTIFICATE, "utf8");
    const block = pem.match(/-----BEGIN CERTIFICATE-----[\s\S]*?-----END CERTIFICATE-----/u)?.[0];
    certificate = new X509Certificate(block);
    key = createPrivateKey(pem);
  } catch { throw new Error("Could not load the approved worker certificate (details withheld)"); }
  if (certificate.fingerprint.replaceAll(":", "") !== entraIdentity.thumbprint
      || Date.parse(certificate.validTo) <= Date.now() || Date.parse(certificate.validFrom) > Date.now()
      || !certificate.checkPrivateKey(key)) throw new Error("Worker certificate identity or validity differs");
  const issued = Math.floor(Date.now() / 1000);
  const encode = (value) => Buffer.from(JSON.stringify(value)).toString("base64url");
  const header = encode({ alg: "RS256", typ: "JWT" });
  const claims = encode({ iss: "urn:openspec:marketplace-publisher", sub: entraIdentity.client,
    aud: audience, ref: "refs/heads/main", channel: "marketplace", run_id: WORKER_RUN,
    iat: issued, nbf: issued - 10, exp: issued + 120 });
  const input = `${header}.${claims}`;
  return `${input}.${sign("RSA-SHA256", Buffer.from(input), key).toString("base64url")}`;
}

export async function api(channel, action, body, { fetcher = fetch, env = process.env, invoke = execFileSync } = {}) {
  if (!["npm", "marketplace"].includes(channel) || !["probe", "claim", "finish"].includes(action)) throw new Error("Unknown publication API action");
  const token = await identity(`${ORIGIN}/api/publications`, env, invoke);
  const response = await request(`${ORIGIN}/api/publications/${channel}/${action}`, {
    method: "POST", redirect: "error", headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify(body),
  }, fetcher);
  return response.json();
}

export async function existing(job, fetcher = fetch) {
  if (job.channel === "npm") {
    const response = await fetcher(`https://registry.npmjs.org/@openspec-ui%2fcli/${job.version}`,
      { signal: AbortSignal.timeout(45_000) });
    if (response.status === 404) return false;
    if (!response.ok) throw new Error(`npm lookup HTTP ${response.status}`);
    const data = await response.json();
    if (data.name !== "@openspec-ui/cli" || data.version !== job.version) throw new Error("npm version mismatch");
    const expected = `https://registry.npmjs.org/@openspec-ui/cli/-/cli-${job.version}.tgz`;
    if (data.dist?.tarball !== expected) throw new Error("Unexpected npm tarball URL");
    const bytes = await download(expected, fetcher);
    if (createHash("sha256").update(bytes).digest("hex") !== job.sha256) throw new Error("Published npm bytes differ");
    return true;
  }
  const response = await request("https://marketplace.visualstudio.com/_apis/public/gallery/extensionquery", {
    method: "POST", headers: { "Content-Type": "application/json", Accept: "application/json;api-version=7.2-preview.1" },
    body: JSON.stringify({ filters: [{ criteria: [{ filterType: 7, value: ITEM }] }], flags: 1 }),
  }, fetcher);
  const data = await response.json();
  return (data.results ?? []).some((result) => (result.extensions ?? []).some((extension) =>
    extension.extensionName === "openspec-ui-vscode" && extension.publisher?.publisherName === "openspec-ui" &&
    (extension.versions ?? []).some((version) => version.version === job.version)));
}

export async function download(url, fetcher = fetch) {
  const response = await request(url, {}, fetcher);
  const chunks = [];
  let size = 0;
  for await (const chunk of response.body) {
    size += chunk.length;
    if (size > 50_000_000) throw new Error("Publication artifact exceeds size limit");
    chunks.push(chunk);
  }
  return Buffer.concat(chunks);
}

export async function probeRegistry(channel, { env = process.env, fetcher = fetch } = {}) {
  if (channel === "marketplace") {
    const assertion = assertionFromCertificate(readFileSync(env.OPENSPEC_MARKETPLACE_CERTIFICATE, "utf8"));
    await probeEntra({ assertion, mode: "verify", request: fetcher });
    const result = spawnSync("vsce", ["verify-pat", "openspec-ui", "--azure-credential"],
      { env: registryEnvironment(channel, env), stdio: "pipe", timeout: 60_000 });
    if (result.status !== 0 || result.error) throw new Error("vsce certificate verification failed (details withheld)");
    return;
  }
  const token = await identity("npm:registry.npmjs.org", env);
  const response = await request("https://registry.npmjs.org/-/npm/v1/oidc/token/exchange/package/@openspec-ui%2fcli", {
    method: "POST", redirect: "error", headers: { Authorization: `Bearer ${token}`, Accept: "application/json" },
  }, fetcher);
  const data = await response.json();
  if (!data.token) throw new Error("Registry did not exchange the OIDC identity");
  // The ephemeral credential is intentionally discarded without logging/storing it.
}

export function registryEnvironment(channel, env) {
  const clean = { ...env };
  for (const name of ["NPM_TOKEN", "NODE_AUTH_TOKEN", "NPM_ID_TOKEN", "VSCE_PAT", "AZURE_CLIENT_SECRET", "AZURE_FEDERATED_TOKEN_FILE"]) delete clean[name];
  if (channel === "marketplace") {
    if (!env.OPENSPEC_MARKETPLACE_CERTIFICATE) throw new Error("The approved certificate is required");
    clean.AZURE_CLIENT_ID = entraIdentity.client;
    clean.AZURE_TENANT_ID = entraIdentity.tenant;
    clean.AZURE_CLIENT_CERTIFICATE_PATH = env.OPENSPEC_MARKETPLACE_CERTIFICATE;
  }
  return clean;
}

export function validatePackage(job, filename, inspect = execFileSync) {
  let manifest;
  try {
    const args = job.channel === "npm" ? ["-xOf", filename, "package/package.json"]
      : ["-p", filename, "extension/package.json"];
    manifest = JSON.parse(inspect(job.channel === "npm" ? "tar" : "unzip", args,
      { encoding: "utf8", maxBuffer: 256_000, timeout: 10_000, stdio: ["ignore", "pipe", "pipe"] }));
  } catch { throw new Error("Cannot read bounded publication package metadata"); }
  if (manifest.version !== job.version || (job.channel === "npm" ? manifest.name !== "@openspec-ui/cli"
    : manifest.name !== "openspec-ui-vscode" || manifest.publisher !== "openspec-ui")) {
    throw new Error("Publication package identity differs from the approved product");
  }
}

export async function npmPublicationTag(version, fetcher = fetch) {
  const response = await fetcher('https://registry.npmjs.org/@openspec-ui%2fcli/latest',
    { redirect: 'error', signal: AbortSignal.timeout(45_000) });
  if (response.status === 404) return 'latest';
  if (!response.ok) throw new Error(`npm latest lookup HTTP ${response.status}`);
  const data = await response.json();
  if (data.name !== '@openspec-ui/cli' || !/^\d+\.\d+\.\d+$/u.test(data.version)) {
    throw new Error('Cannot establish the stable npm latest version');
  }
  const proposed = version.split('.').map(BigInt);
  const latest = data.version.split('.').map(BigInt);
  for (let index = 0; index < 3; index += 1) {
    if (proposed[index] > latest[index]) return 'latest';
    if (proposed[index] < latest[index]) return `recovery-${version.replaceAll('.', '-')}`;
  }
  return 'latest';
}

export async function publish(job, filename, { env = process.env, invoke = spawnSync, getIdentity = identity, inspect = execFileSync, fetcher = fetch } = {}) {
  validatePackage(job, filename, inspect);
  const clean = registryEnvironment(job.channel, env);
  if (job.channel === "npm") clean.NPM_ID_TOKEN = await getIdentity("npm:registry.npmjs.org", env);
  const tag = job.channel === "npm" ? await npmPublicationTag(job.version, fetcher) : null;
  const command = job.channel === "npm" ? "npm" : "vsce";
  const args = job.channel === "npm"
    ? ["publish", filename, "--tag", tag, "--access", "public", "--provenance=false", "--ignore-scripts", "--registry=https://registry.npmjs.org"]
    : ["publish", "--azure-credential", "--packagePath", filename];
  const result = invoke(command, args, { cwd: path.dirname(filename), env: clean, stdio: "inherit", timeout: 180_000 });
  if (result.status !== 0 || result.error) throw new Error(`${command} publication failed`);
}

export async function run(channel, { call = api, fetcher = fetch, publishArtifact = publish, probe = false, registryProbe = probeRegistry, receiptKey } = {}) {
  if (!["npm", "marketplace"].includes(channel)) throw new Error("Unknown publication channel");
  if (probe) {
    const result = await call(channel, "probe", {});
    console.log(`Homepage worker identity verified: ${result.worker}`);
    await registryProbe(channel);
    console.log(`${channel} OIDC exchange verified without publishing.`);
    return;
  }
  const { job } = await call(channel, "claim", {});
  if (!job) {
    console.log(`No ${channel} publications are due.`);
    return;
  }
  let directory;
  let failure;
  try {
    const filename = validateJob(job, channel);
    verifyReceipt(job, receiptKey);
    if (!await existing(job, fetcher)) {
      const bytes = await download(job.artifact_url, fetcher);
      if (createHash("sha256").update(bytes).digest("hex") !== job.sha256) throw new Error("Approved artifact checksum mismatch");
      directory = await mkdtemp(path.join(tmpdir(), "openspec-publication-"));
      const artifact = path.join(directory, filename);
      await writeFile(artifact, bytes);
      await publishArtifact(job, artifact, { fetcher });
    }
  } catch (error) {
    failure = error;
  } finally {
    if (directory) await rm(directory, { recursive: true });
  }
  // Always reconcile, even after a publish command lost its successful response.
  const result = await call(channel, "finish", { id: job.id, lease: job.lease });
  if (result.state !== "published") throw failure ?? new Error("Platform confirmation is pending; Homepage retains the failure");
  console.log(`Confirmed ${channel} ${job.version}: ${result.url}`);
}

export function probeRequested(value) {
  if (value === undefined || value === "false") return false;
  if (value === "true") return true;
  throw new Error("Invalid publication probe mode; refusing to claim work");
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    await run(process.argv[2], { probe: probeRequested(process.env.PUBLICATION_PROBE) });
  } catch (error) {
    console.error(`Publication failed: ${error.message}`);
    process.exitCode = 1;
  }
}
