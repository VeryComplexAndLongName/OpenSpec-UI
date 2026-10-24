import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";
import YAML from "yaml";

const REPO = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const SCRIPT = path.join(REPO, "packages/cli/scripts/write-release-notes.ts");
const COPY = "## 1.0.0\n\n### Patch Changes\n\n- **Codex CLI and ACP.** Run stages\n  with a GPT model and reasoning effort.\n- Updated dependencies [abc1234]\n  - @openspec-ui/core@1.0.0\n";
function run(...args) {
  return spawnSync(process.execPath, ["--import", "tsx", SCRIPT, ...args], {
    cwd: REPO, encoding: "utf8", windowsHide: true, timeout: 30_000,
  });
}
async function fixture(work) {
  const root = await mkdtemp(path.join(os.tmpdir(), "release-copy-"));
  try {
    await work(root);
  } finally {
    assert.equal(path.dirname(path.resolve(root)), path.resolve(os.tmpdir()));
    assert.ok(path.basename(root).startsWith("release-copy-"));
    await rm(root, { recursive: true, force: true });
  }
}

test("release note generator retains complete authored copy and drops dependency lists", { timeout: 45_000 }, async () => {
  await fixture(async (root) => {
    const input = path.join(root, "CHANGELOG.md");
    const output = path.join(root, "notes.md");
    await writeFile(input, COPY);
    const result = run(input, "1.0.0", output);
    assert.equal(result.status, 0, result.stderr);
    assert.equal(await readFile(output, "utf8"), "## Highlights\n\n- **Codex CLI and ACP.** Run stages with a GPT model and reasoning effort.\n");
  });
});

test("release note generator refuses mismatched and dependency-only notes without writing output", { timeout: 45_000 }, async () => {
  await fixture(async (root) => {
    const input = path.join(root, "CHANGELOG.md");
    const output = path.join(root, "notes.md");
    for (const [copy, version] of [[COPY, "2.0.0"], ["## 1.0.0\n\n- Updated dependencies [abc1234]\n  - @openspec-ui/core@1.0.0\n", "1.0.0"]]) {
      await writeFile(input, copy);
      assert.notEqual(run(input, version, output).status, 0);
      await assert.rejects(readFile(output), { code: "ENOENT" });
    }
  });
});

test("public-note validation requires each delivery while keeping Core internal", { timeout: 45_000 }, async () => {
  await fixture(async (root) => {
    for (const name of ["extension", "server", "cli", "core"]) {
      const dir = path.join(root, "packages", name);
      await mkdir(dir, { recursive: true });
      await writeFile(path.join(dir, "package.json"), JSON.stringify({ version: "1.0.0" }));
      await writeFile(path.join(dir, "CHANGELOG.md"), name === "core" ? "No public notes.\n" : COPY);
    }
    assert.equal(run("--check", root).status, 0);
    await writeFile(path.join(root, "packages/server/CHANGELOG.md"), "## 1.0.0\n\n- Updated dependencies\n");
    const result = run("--check", root);
    assert.notEqual(result.status, 0);
    assert.match(result.stderr, /standalone-app@1.0.0 needs an authored product note/);
  });
});

test("release workflow validates version notes and prepares Highlights before tagging", async () => {
  const workflow = YAML.parse(await readFile(path.join(REPO, ".github/workflows/quality.yml"), "utf8"));
  assert.ok(workflow.jobs["version-pr"].steps.some((step) => step.run?.includes("write-release-notes.ts --check")));
  const script = workflow.jobs["release-extension"].steps.find((step) => step.id === "release").run;
  const generate = script.indexOf("write-release-notes.ts");
  assert.ok(generate >= 0 && generate < script.indexOf("git tag -a"));
  assert.match(script, /--notes-file "\$\{RUNNER_TEMP\}\/release-notes\.md"/);
  assert.match(script, /--generate-notes/);
});
