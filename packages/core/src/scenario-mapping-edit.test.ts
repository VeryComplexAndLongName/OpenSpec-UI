import { execFile } from "node:child_process";
import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { promisify } from "node:util";
import { expect, it, vi } from "vitest";
import { editScenarioMapping } from "./scenario-mapping-edit.js";
import { gitIsolationArgs } from "./test-support/git-isolation.js";

vi.setConfig({ testTimeout: 60_000 });
const exec = promisify(execFile);

it("previews without writing, refuses stale saves and preserves existing working-tree associations", async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), "osw-scenario-map-"));
  const config = await gitIsolationArgs();
  const git = async (...args: string[]) => (await exec("git", [...config,
    "-c", "user.name=Fixture", "-c", "user.email=fixture@example.invalid", ...args], { cwd: root })).stdout.trim();
  try {
    await git("init", "-b", "main");
    const change = "edit-shipping";
    const directory = path.join(root, "openspec", "changes", change);
    await mkdir(directory, { recursive: true });
    await writeFile(path.join(directory, "proposal.md"), "Edit shipping.\n");
    await git("add", ".");
    await git("commit", "-m", "Proposal");
    const head = await git("rev-parse", "HEAD");
    const scenario = { capability: "checkout", requirement: "Shipping", scenario: "Address changes" };
    const options = { scenarios: [scenario], checks: ["build", "test"] };
    const selection = { head, scenario, check: "test" };
    const file = path.join(directory, "scenario-checks.json");
    const draft = await editScenarioMapping(root, change, { mode: "preview", selection }, head, options);
    expect(draft).toHaveProperty("preview.diff", expect.stringMatching(/^\+\s*"test"/mu));
    if (!("preview" in draft)) throw new Error("Missing preview.");
    await expect(readFile(file)).rejects.toMatchObject({ code: "ENOENT" });
    await writeFile(file, JSON.stringify({ scenarios: [{ ...scenario, checks: ["build"] }] }));
    await expect(editScenarioMapping(root, change, { mode: "save", selection, revision: draft.preview.revision }, head, options))
      .rejects.toThrow("mapping changed");
    const fresh = await editScenarioMapping(root, change, { mode: "preview", selection }, head, options);
    if (!("preview" in fresh)) throw new Error("Missing second preview.");
    expect(await editScenarioMapping(root, change, { mode: "save", selection, revision: fresh.preview.revision }, head, options)).toEqual({ saved: true });
    expect(JSON.parse(await readFile(file, "utf8"))).toEqual({ scenarios: [{ ...scenario, checks: ["build", "test"] }] });
  } finally {
    await rm(root, { recursive: true, force: true, maxRetries: 4 });
  }
});
