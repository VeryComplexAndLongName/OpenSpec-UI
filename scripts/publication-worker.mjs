// A bounded transport worker. Homepage owns the durable publication lifecycle.
import { createHash } from "node:crypto";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const ORIGIN = "https://openspec-ui.dev";
const REPO = "VeryComplexAndLongName/OpenSpec-UI";
const ITEM = "openspec-ui.openspec-ui-vscode";

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

export async function identity(audience, env = process.env, fetcher = fetch) {
  if (!env.ACTIONS_ID_TOKEN_REQUEST_URL || !env.ACTIONS_ID_TOKEN_REQUEST_TOKEN) throw new Error("OIDC is required");
  const url = new URL(env.ACTIONS_ID_TOKEN_REQUEST_URL);
  if (url.protocol !== "https:") throw new Error("OIDC endpoint must use TLS");
  url.searchParams.set("audience", audience);
  const response = await request(url, {
    headers: { Authorization: `Bearer ${env.ACTIONS_ID_TOKEN_REQUEST_TOKEN}` },
  }, fetcher);
  const token = (await response.json()).value;
  if (typeof token !== "string" || !token) throw new Error("No OIDC identity returned");
  return token;
}

export async function api(channel, action, body, { fetcher = fetch, env = process.env } = {}) {
  const token = await identity(`${ORIGIN}/api/publications`, env, fetcher);
  const response = await request(`${ORIGIN}/api/publications/${channel}/${action}`, {
    method: "POST", headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
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
  const audience = channel === "npm" ? "npm:registry.npmjs.org" : "marketplace.visualstudio.com";
  const token = await identity(audience, env, fetcher);
  const url = channel === "npm"
    ? "https://registry.npmjs.org/-/npm/v1/oidc/token/exchange/package/@openspec-ui%2fcli"
    : "https://marketplace.visualstudio.com/_apis/gallery/token?api-version=7.2-preview.1";
  const response = await request(url, { method: "POST", headers: {
    Authorization: `${channel === "npm" ? "Bearer" : "FederatedToken"} ${token}`,
    "Content-Type": "application/json", Accept: "application/json", "User-Agent": "vsce",
  }, ...(channel === "marketplace" ? { body: JSON.stringify({ publisherName: "openspec-ui" }) } : {}) }, fetcher);
  const data = await response.json();
  if (!data[channel === "npm" ? "token" : "credential"]) throw new Error("Registry did not exchange the OIDC identity");
  // The ephemeral credential is intentionally discarded without logging/storing it.
}

function publish(job, filename) {
  const command = job.channel === "npm" ? "npm" : "vsce";
  const args = job.channel === "npm"
    ? ["publish", filename, "--access", "public", "--provenance", "--ignore-scripts"]
    : ["publish", "--oidc", "--packagePath", filename];
  const result = spawnSync(command, args, { stdio: "inherit", timeout: 180_000 });
  if (result.status !== 0 || result.error) throw new Error(`${command} publication failed`);
}

export async function run(channel, { call = api, fetcher = fetch, publishArtifact = publish, probe = false, registryProbe = probeRegistry } = {}) {
  if (!["npm", "marketplace"].includes(channel)) throw new Error("Unknown publication channel");
  if (probe) {
    const result = await call(channel, "probe", {});
    console.log(`Homepage OIDC verified: ${result.worker}`);
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
    if (!await existing(job, fetcher)) {
      const bytes = await download(job.artifact_url, fetcher);
      if (createHash("sha256").update(bytes).digest("hex") !== job.sha256) throw new Error("Approved artifact checksum mismatch");
      directory = await mkdtemp(path.join(tmpdir(), "openspec-publication-"));
      const artifact = path.join(directory, filename);
      await writeFile(artifact, bytes);
      await publishArtifact(job, artifact);
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

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    await run(process.argv[2], { probe: process.env.PUBLICATION_PROBE === "true" });
  } catch (error) {
    console.error(`Publication failed: ${error.message}`);
    process.exitCode = 1;
  }
}
