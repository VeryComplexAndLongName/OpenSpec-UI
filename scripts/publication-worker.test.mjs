import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { api, identity, run, validateJob } from "./publication-worker.mjs";
import { entry } from "./publication-manifest.mjs";

const bytes = Buffer.from("immutable release");
const job = { id: 1, channel: "npm", version: "1.2.3", lease: "a".repeat(32), commit: "b".repeat(40),
  sha256: createHash("sha256").update(bytes).digest("hex"),
  artifact_url: "https://github.com/VeryComplexAndLongName/OpenSpec-UI/releases/download/openspec-ui-cli@1.2.3/openspec-ui-cli-1.2.3.tgz" };

test("contract hashes released bytes and refuses ambiguous artifacts", () => {
  const release = { assets: [{ name: "openspec-ui-cli-1.2.3.tgz", url: job.artifact_url }] };
  assert.equal(entry("npm", "1.2.3", release, job.commit, bytes).sha256, job.sha256);
  assert.throws(() => entry("npm", "1.2.3", { ...release, assets: [] }, job.commit, bytes));
  assert.throws(() => entry("npm", "1.2.3", { ...release, isDraft: true }, job.commit, bytes));
});

test("refuses untrusted artifact URL, malformed version and checksum", () => {
  assert.equal(validateJob(job, "npm"), "openspec-ui-cli-1.2.3.tgz");
  for (const override of [{ artifact_url: "https://evil.example/pkg.tgz" }, { version: "1.2.3;exec" },
    { sha256: "bad" }, { artifact_url: job.artifact_url.replace("OpenSpec-UI/", "other/") }, { channel: "devto" }]) {
    assert.throws(() => validateJob({ ...job, ...override }, "npm"));
  }
});

function platform({ published = false, mismatch = false } = {}) {
  return async (url) => {
    if (String(url).includes("@openspec-ui%2fcli/")) return published ? Response.json({
      name: "@openspec-ui/cli", version: "1.2.3", dist: { tarball: "https://registry.npmjs.org/@openspec-ui/cli/-/cli-1.2.3.tgz" },
    }) : new Response("", { status: 404 });
    return new Response(mismatch ? "different bytes" : bytes);
  };
}

test("publishes exact approved bytes and reports completion", async () => {
  const calls = [];
  let sent = false;
  await run("npm", { fetcher: platform(), call: async (_, action) => {
    calls.push(action);
    return action === "claim" ? { job } : { state: "published", url: "https://www.npmjs.com/package/@openspec-ui/cli" };
  }, publishArtifact: async (_, artifact) => { assert.deepEqual(await readFile(artifact), bytes); sent = true; } });
  assert.equal(sent, true);
  assert.deepEqual(calls, ["claim", "finish"]);
});

test("lost successful response reconciles without another write", async () => {
  let writes = 0;
  await run("npm", { fetcher: platform({ published: true }), call: async (_, action) =>
    action === "claim" ? { job } : { state: "published", url: "https://www.npmjs.com/package/@openspec-ui/cli" },
  publishArtifact: () => { writes++; } });
  assert.equal(writes, 0);
});

test("checksum failure reports finish but never publishes", async () => {
  let finished = false;
  await assert.rejects(run("npm", { fetcher: platform({ mismatch: true }), call: async (_, action) => {
    if (action === "claim") return { job };
    finished = true;
    return { state: "retry" };
  }, publishArtifact: () => assert.fail("must not publish") }), /checksum mismatch/u);
  assert.equal(finished, true);
});

test("a failed publish remains a failed run unless platform confirms", async () => {
  for (const state of ["retry", "published"]) {
    const work = run("npm", { fetcher: platform(), call: async (_, action) => action === "claim" ? { job } : { state },
      publishArtifact: () => { throw new Error("lost publish response"); } });
    if (state === "retry") await assert.rejects(work, /lost publish response/u);
    else await work;
  }
});

test("an empty queue and identity probe perform no platform calls", async () => {
  await run("npm", { call: async () => ({ job: null }), fetcher: () => assert.fail("no registry request") });
  await run("marketplace", { probe: true, call: async (_, action) => {
    assert.equal(action, "probe"); return { worker: "github:123:1:marketplace" };
  }, fetcher: () => assert.fail("no registry request"), registryProbe: async (channel) => assert.equal(channel, "marketplace") });
});

test("OIDC uses the Homepage audience, fresh identity and bearer HTTP", async () => {
  const env = { ACTIONS_ID_TOKEN_REQUEST_URL: "https://github.example/token?x=1", ACTIONS_ID_TOKEN_REQUEST_TOKEN: "request-secret" };
  const calls = [];
  const fetcher = async (url, options) => {
    calls.push([String(url), options]);
    return String(url).startsWith("https://github.example") ? Response.json({ value: "short-lived-jwt" }) : Response.json({ worker: "verified" });
  };
  await api("npm", "probe", {}, { env, fetcher });
  assert.equal(new URL(calls[0][0]).searchParams.get("audience"), "https://openspec-ui.dev/api/publications");
  assert.equal(calls[1][1].headers.Authorization, "Bearer short-lived-jwt");
  await assert.rejects(identity("audience", {}, fetcher), /OIDC is required/u);
});
