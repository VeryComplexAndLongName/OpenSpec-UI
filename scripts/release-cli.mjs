// Prepare a CLI release once. Adopt already-published npm bytes at cutover.
import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";

const { version } = JSON.parse(await readFile("packages/cli/package.json", "utf8"));
if (!/^\d+\.\d+\.\d+$/u.test(version)) throw new Error("Only stable CLI releases are eligible");
const tag = `openspec-ui-cli@${version}`;
try {
  execFileSync("gh", ["release", "view", tag], { stdio: "pipe" });
  console.log(`${tag} already has a release; reusing its immutable artifact.`);
} catch {
  // A previously created tag without a release is deliberately not rebuilt.
  try {
    execFileSync("git", ["rev-parse", "--verify", `refs/tags/${tag}`], { stdio: "pipe" });
    throw new Error("Existing CLI tag has no release; reconcile it before continuing");
  } catch (error) {
    if (!error.status) throw error;
  }
  const directory = await mkdtemp(path.join(tmpdir(), "cli-release-"));
  try {
    let commit = process.env.GITHUB_SHA;
    const artifact = path.join(directory, `openspec-ui-cli-${version}.tgz`);
    const response = await fetch(`https://registry.npmjs.org/@openspec-ui%2fcli/${version}`,
      { signal: AbortSignal.timeout(45_000) });
    if (response.ok) {
      const metadata = await response.json();
      const expected = `https://registry.npmjs.org/@openspec-ui/cli/-/cli-${version}.tgz`;
      if (metadata.name !== "@openspec-ui/cli" || metadata.version !== version ||
          metadata.dist?.tarball !== expected || !/^[a-f0-9]{40}$/u.test(metadata.gitHead)) throw new Error("Invalid existing npm release");
      commit = metadata.gitHead;
      execFileSync("git", ["cat-file", "-e", `${commit}^{commit}`]);
      execFileSync("git", ["merge-base", "--is-ancestor", commit, process.env.GITHUB_SHA || "HEAD"]);
      const tarball = await fetch(expected, { signal: AbortSignal.timeout(45_000) });
      if (!tarball.ok) throw new Error(`npm artifact HTTP ${tarball.status}`);
      const bytes = Buffer.from(await tarball.arrayBuffer());
      if (metadata.dist.integrity !== `sha512-${createHash("sha512").update(bytes).digest("base64")}`) throw new Error("npm artifact integrity mismatch");
      await writeFile(artifact, bytes);
    } else if (response.status === 404) {
      execFileSync("npm", ["run", "build", "--workspace", "@openspec-ui/cli"], { stdio: "inherit" });
      const packed = JSON.parse(execFileSync("npm", ["pack", "--workspace", "@openspec-ui/cli", "--ignore-scripts", "--json", "--pack-destination", directory], { encoding: "utf8" }));
      const { rename } = await import("node:fs/promises");
      await rename(path.join(directory, packed[0].filename), artifact);
    } else throw new Error(`npm lookup HTTP ${response.status}`);
    if (!/^[a-f0-9]{40}$/u.test(commit)) throw new Error("Invalid release commit");
    if (process.argv.includes("--dry-run")) {
      const digest = createHash("sha256").update(await readFile(artifact)).digest("hex");
      console.log(`Prepared ${tag} from ${commit}, SHA-256 ${digest}; no tag, release or registry write.`);
    } else {
      execFileSync("git", ["tag", "-a", tag, commit, "-m", `@openspec-ui/cli ${version}`]);
      execFileSync("git", ["push", "origin", tag], { stdio: "inherit" });
      execFileSync("gh", ["release", "create", tag, artifact, "--title", `@openspec-ui/cli ${version}`,
        "--notes", `Immutable CLI artifact from ${commit}.`, "--latest=false"], { stdio: "inherit" });
    }
  } finally {
    await rm(directory, { recursive: true });
  }
}
