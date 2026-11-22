// Build a public contract from existing immutable GitHub Releases, never source layout guesses.
import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

export function entry(channel, version, release, commit, bytes) {
  if (!/^\d+\.\d+\.\d+$/u.test(version) || !/^[a-f0-9]{40}$/u.test(commit)) throw new Error("Invalid release identity");
  const suffix = channel === "npm" ? ".tgz" : ".vsix";
  const assets = release.assets.filter((asset) => asset.name.endsWith(`${version}${suffix}`));
  if (assets.length !== 1 || release.isDraft || release.isPrerelease) throw new Error("Expected one stable release artifact");
  return { channel, version, artifact_url: assets[0].url, commit,
    sha256: createHash("sha256").update(bytes).digest("hex") };
}

async function main() {
  const publications = [];
  let previous = [];
  try {
    previous = JSON.parse(execFileSync("git", ["show", "origin/release-manifest:publications.json"], { encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] })).publications;
    if (!Array.isArray(previous)) throw new Error("Invalid previous publication contract");
  } catch (error) {
    if (!error.status) throw error;
  }
  for (const [channel, directory, prefix] of [["npm", "cli", "openspec-ui-cli"], ["marketplace", "extension", "openspec-ui-vscode"]]) {
    const { version } = JSON.parse(await readFile(`packages/${directory}/package.json`, "utf8"));
    const tag = `${prefix}@${version}`;
    const release = JSON.parse(execFileSync("gh", ["release", "view", tag, "--json", "assets,isDraft,isPrerelease"], { encoding: "utf8" }));
    const suffix = channel === "npm" ? ".tgz" : ".vsix";
    const asset = release.assets.filter((one) => one.name.endsWith(`${version}${suffix}`));
    if (asset.length !== 1) throw new Error(`Missing unique release asset for ${tag}`);
    const response = await fetch(asset[0].url, { signal: AbortSignal.timeout(60_000) });
    if (!response.ok) throw new Error(`Cannot download ${tag}: HTTP ${response.status}`);
    const bytes = Buffer.from(await response.arrayBuffer());
    const commit = execFileSync("git", ["rev-parse", `${tag}^{commit}`], { encoding: "utf8" }).trim();
    const current = entry(channel, version, release, commit, bytes);
    const prior = previous.find((one) => one.channel === channel && one.version === version);
    if (prior && JSON.stringify(prior) !== JSON.stringify(current)) throw new Error(`Released bytes changed for ${tag}`);
    publications.push(current);
  }
  publications.push(...previous.filter((one) => !publications.some((current) => current.channel === one.channel && current.version === one.version)));
  publications.splice(100);
  await writeFile("publications.json", `${JSON.stringify({ schema_version: 1,
    repository: "VeryComplexAndLongName/OpenSpec-UI", publications }, null, 2)}\n`);
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) await main();
