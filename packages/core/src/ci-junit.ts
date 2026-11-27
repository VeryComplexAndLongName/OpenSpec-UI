import { fromBuffer, type Entry, type ZipFile } from "yauzl";
import { z } from "zod";
import { JUNIT_XML_MAX_BYTES } from "./change-actions.js";

const reportName = "junit.xml";
const revisionName = "tested-commit.txt";
const archiveName = "openspec-junit";
const metadataLimit = 512 * 1024;
const archiveLimit = 256 * 1024;
const fullSha = z.string().regex(/^[a-f0-9]{40}(?:[a-f0-9]{24})?$/u);
const id = z.number().int().positive().max(Number.MAX_SAFE_INTEGER);
export const ciJUnitRequest = z.strictObject({ head: fullSha, execution: id });
export type CiJUnitRequest = z.infer<typeof ciJUnitRequest>;
export const ciJUnitSource = z.strictObject({
  forge: z.enum(["Gitea", "GitLab"]),
  repository: z.string().min(1).max(512),
  execution: id,
  artifact: id.optional(),
  pipeline: id.optional(),
});
export type CiJUnitSource = z.infer<typeof ciJUnitSource>;
export interface CiJUnitReport {
  source: CiJUnitSource;
  testedCommit: string;
  xml: string;
}
interface ForgeArtifactOrigin {
  api: string;
  repository: string;
  headers: Record<string, string>;
  fetch?: typeof fetch;
}

async function readBounded(origin: ForgeArtifactOrigin, suffix: string, limit: number,
  redirectKind?: "gitea-zip" | "gitlab-artifact",
): Promise<Buffer> {
  const url = new URL(origin.api + suffix);
  const fetchImpl = origin.fetch ?? globalThis.fetch;
  const signal = AbortSignal.timeout(20_000);
  let response = await fetchImpl(url, { headers: origin.headers, signal, redirect: "manual" });
  if (response.status >= 300 && response.status < 400) {
    const location = response.headers.get("location");
    await response.body?.cancel();
    const target = location ? new URL(location, url) : undefined;
    const giteaRaw = redirectKind === "gitea-zip" && target?.origin === url.origin && target.pathname === url.pathname + "/raw";
    const gitlabStorage = redirectKind === "gitlab-artifact" && url.origin === "https://gitlab.com"
      && target?.origin === "https://storage.googleapis.com";
    if (!target || target.username || target.password || (!giteaRaw && !gitlabStorage)) {
      throw new Error("The CI artifact redirected outside the supported storage endpoint.");
    }
    // Signed storage URLs authorize the download themselves. Never forward the forge credential.
    response = await fetchImpl(target, { signal, redirect: "error", credentials: "omit" });
  }
  if (!response.ok || !response.body) {
    await response.body?.cancel();
    throw new Error(`The CI endpoint returned HTTP ${response.status}. Check the execution ID, artifact and token access.`);
  }
  const stream = response.body.getReader();
  const chunks: Uint8Array[] = [];
  let size = 0;
  let finished = false;
  try {
    if (Number(response.headers.get("content-length")) > limit) throw new Error("The CI response exceeds the import limit.");
    for (;;) {
      const part = await stream.read();
      if (part.done) {
        finished = true;
        return Buffer.concat(chunks, size);
      }
      size += part.value.length;
      if (size > limit) throw new Error("The CI response exceeds the import limit.");
      chunks.push(part.value);
    }
  } finally {
    if (!finished) await stream.cancel().catch(() => undefined);
    stream.releaseLock();
  }
}

async function metadata(origin: ForgeArtifactOrigin, suffix: string): Promise<unknown> {
  return JSON.parse((await readBounded(origin, suffix, metadataLimit)).toString("utf8"));
}

function readEntry(zip: ZipFile, entry: Entry, limit: number): Promise<string> {
  return new Promise((resolve, reject) => {
    zip.openReadStream(entry, (error, stream) => {
      if (error || !stream) { reject(error ?? new Error("The CI archive entry could not be read.")); return; }
      const chunks: Buffer[] = [];
      let size = 0;
      stream.on("error", reject);
      stream.on("data", (chunk: Buffer) => {
        size += chunk.length;
        if (size > limit) stream.destroy(new Error("The CI archive entry exceeds the import limit."));
        else chunks.push(chunk);
      });
      stream.on("end", () => resolve(Buffer.concat(chunks).toString("utf8")));
    });
  });
}

function readGiteaArchive(bytes: Buffer): Promise<{ xml: string; revision: string }> {
  return new Promise((resolve, reject) => {
    fromBuffer(bytes, { lazyEntries: true, strictFileNames: true, validateEntrySizes: true }, (error, zip) => {
      if (error || !zip) { reject(error ?? new Error("The CI artifact is not a ZIP archive.")); return; }
      const files = new Map<string, string>();
      const refuse = (reason: unknown) => { zip.close(); reject(reason); };
      zip.on("error", refuse);
      zip.on("end", () => {
        const xml = files.get(reportName);
        const revision = files.get(revisionName);
        if (xml === undefined || revision === undefined) reject(new Error("The CI archive must contain junit.xml and tested-commit.txt."));
        else resolve({ xml, revision });
      });
      zip.on("entry", (entry: Entry) => {
        const name = entry.fileName;
        const limit = name === reportName ? JUNIT_XML_MAX_BYTES : 80;
        if ((name !== reportName && name !== revisionName) || files.has(name)
            || entry.uncompressedSize > limit || (entry.generalPurposeBitFlag & 1) !== 0) {
          refuse(new Error("The CI archive contains an unexpected, duplicate or oversized entry."));
          return;
        }
        void readEntry(zip, entry, limit).then((value) => { files.set(name, value); zip.readEntry(); }, refuse);
      });
      if (zip.entryCount !== 2) refuse(new Error("The CI archive must contain exactly two files."));
      else zip.readEntry();
    });
  });
}

function verifiedReport(source: CiJUnitSource, commit: string, revision: string, xml: string): CiJUnitReport {
  if (revision.trim() !== commit) throw new Error("The CI checkout revision does not match the execution metadata.");
  return { source, testedCommit: commit, xml };
}

const giteaRun = z.object({ id, head_sha: fullSha });
const giteaArtifact = z.object({ id, name: z.string(), expired: z.boolean(), size_in_bytes: z.number().nonnegative(),
  workflow_run: giteaRun.extend({ repository_id: id }) });

export async function readGiteaJUnit(origin: ForgeArtifactOrigin, execution: number): Promise<CiJUnitReport> {
  id.parse(execution);
  const base = `/actions/runs/${execution}`;
  const [runMetadata, repositoryMetadata] = await Promise.all([metadata(origin, base), metadata(origin, "")]);
  const run = giteaRun.parse(runMetadata);
  const repository = z.object({ id }).parse(repositoryMetadata);
  if (run.id !== execution) throw new Error("Gitea returned a different workflow run.");
  const { artifacts, total_count } = z.object({ artifacts: z.array(z.unknown()).max(100), total_count: z.number().optional() })
    .parse(await metadata(origin, base + "/artifacts"));
  const matches = artifacts.filter((entry) => typeof entry === "object" && entry !== null && "name" in entry && entry.name === archiveName);
  if (matches.length !== 1 || (total_count !== undefined && total_count !== artifacts.length)) {
    throw new Error("The Gitea run must expose one unique openspec-junit artifact.");
  }
  const artifact = giteaArtifact.parse(matches[0]);
  const identity = artifact.workflow_run;
  if (artifact.expired || artifact.size_in_bytes > archiveLimit || identity.id !== run.id
      || identity.repository_id !== repository.id || identity.head_sha !== run.head_sha) {
    throw new Error("The Gitea artifact is expired, oversized or belongs to different run metadata.");
  }
  const report = await readGiteaArchive(await readBounded(origin, `/actions/artifacts/${artifact.id}/zip`, archiveLimit, "gitea-zip"));
  return verifiedReport({ forge: "Gitea", repository: origin.repository, execution, artifact: artifact.id }, run.head_sha, report.revision, report.xml);
}

const gitlabJob = z.object({ id, commit: z.object({ id: fullSha }), pipeline: z.object({ id, sha: fullSha }) });

export async function readGitLabJUnit(origin: ForgeArtifactOrigin, execution: number): Promise<CiJUnitReport> {
  id.parse(execution);
  const base = `/jobs/${execution}`;
  const job = gitlabJob.parse(await metadata(origin, base));
  if (job.id !== execution || job.commit.id !== job.pipeline.sha) {
    throw new Error("GitLab returned inconsistent job and pipeline metadata.");
  }
  const revision = (await readBounded(origin, `${base}/artifacts/${revisionName}`, 80, "gitlab-artifact")).toString("utf8");
  if (revision.trim() !== job.commit.id) throw new Error("The CI checkout revision does not match the execution metadata.");
  const xml = (await readBounded(origin, `${base}/artifacts/${reportName}`, JUNIT_XML_MAX_BYTES, "gitlab-artifact")).toString("utf8");
  return verifiedReport({ forge: "GitLab", repository: origin.repository, execution, pipeline: job.pipeline.id }, job.commit.id, revision, xml);
}
