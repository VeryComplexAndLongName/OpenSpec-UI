import { execFile } from "node:child_process";
import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { promisify } from "node:util";
import { expect, it, vi } from "vitest";
import { readSpecArchivePreview } from "./spec-archive-preview.js";
import { gitIsolationArgs } from "./test-support/git-isolation.js";

// A git fixture. The local smoke run also uses the real OpenSpec CLI.
vi.setConfig({ testTimeout: 60_000 });
const exec = promisify(execFile);
const checkout = "openspec/specs/checkout/spec.md";
const baseSpec = "# Checkout\n\n## Purpose\n\nOrder placement.\n\n## Requirements\n\n"
  + "### Requirement: Address\nThe checkout SHALL keep the address.\n\n"
  + "#### Scenario: Save\n- **WHEN** saved\n- **THEN** the address is kept\n";

it("previews a real archive and names parallel changes without changing the checkout", async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), "openspec-archive-preview-test-"));
  const config = await gitIsolationArgs();
  const git = async (...args: string[]) =>
    (await exec("git", [...config, "-c", "user.name=Fixture", "-c", "user.email=fixture@example.invalid", ...args], { cwd: root })).stdout;
  const write = async (name: string, body: string) => {
    const file = path.join(root, name);
    await mkdir(path.dirname(file), { recursive: true });
    await writeFile(file, body);
  };
  try {
    await git("init", "-b", "main");
    await write(checkout, baseSpec);
    await git("add", ".");
    await git("commit", "-m", "Base");
    const base = (await git("rev-parse", "HEAD")).trim();
    for (const name of ["other-change", "edit-address"]) {
      await git("switch", "-c", name, base);
      const dir = `openspec/changes/${name}`;
      await write(`${dir}/proposal.md`, "## Why\n\nAddress handling.\n");
      await write(`${dir}/tasks.md`, "## 1. Tasks\n\n- [ ] 1.1 Change address.\n");
      await write(`${dir}/specs/checkout/spec.md`,
        "## MODIFIED Requirements\n\n" + baseSpec.slice(baseSpec.indexOf("### Requirement:")).replace("keep the address", "validate the address"));
      await git("add", ".");
      await git("commit", "-m", name);
    }
    await git("switch", "main");
    await write(checkout, baseSpec.replace("keep the address", "store the address"));
    await git("add", ".");
    await git("commit", "-m", "Update base address text");
    await git("switch", "edit-address");
    const before = await git("show-ref");
    const apply = process.env.OPENSPEC_UI_REAL_ARCHIVE_PREVIEW === "1" ? undefined
      : vi.fn<typeof import("./openspec.js").applyArchiveInDirectory>(async (name, options) => {
        expect(options.cwd).not.toBe(root);
        expect(await readFile(path.join(options.cwd, checkout), "utf8")).toContain("store the address");
        const delta = await readFile(path.join(options.cwd, "openspec", "changes", name, "specs/checkout/spec.md"), "utf8");
        await writeFile(path.join(options.cwd, checkout), delta.replace("## MODIFIED Requirements", "## Requirements"));
        return {};
      });
    const result = await readSpecArchivePreview(root, "edit-address", apply);
    expect(result).toContain("changed on the default branch");
    expect(result).toContain("also appears in `other-change`");
    expect(result).toContain("+The checkout SHALL validate the address.");
    expect(await git("status", "--porcelain")).toBe("");
    expect(await git("show-ref")).toBe(before);
  } finally {
    await rm(root, { recursive: true, force: true, maxRetries: 4 });
  }
});
