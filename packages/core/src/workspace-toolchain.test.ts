import { createHash } from "node:crypto";
import { mkdir, mkdtemp, rm, symlink, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { expect, it, vi } from "vitest";
import { readWorkspaceToolchain } from "./workspace-toolchain.js";

vi.setConfig({ testTimeout: 10_000 });

it("compares exact OpenSpec pins, normalizes line endings and refuses unsafe instruction files", async () => {
  const area = await mkdtemp(path.join(os.tmpdir(), "osw-toolchain-"));
  const root = path.join(area, "workspace");
  const configDir = path.join(root, "openspec");
  const outside = path.join(area, "outside");
  const config = path.join(configDir, "workbench-tools.json");
  try {
    await mkdir(configDir, { recursive: true });
    await mkdir(outside);
    await writeFile(path.join(outside, "secret.md"), "Owner data");
    await symlink(outside, path.join(root, "other"), "junction");
    await writeFile(path.join(root, "AGENTS.md"), "Review code.\r\n");
    const sha256 = createHash("sha256").update("Review code.\n").digest("hex");
    await writeFile(config, JSON.stringify({ openspecVersion: "1.13.2", instructions: [
      { path: "AGENTS.md", sha256 }, { path: "missing.md", sha256 }, { path: "other/secret.md", sha256 },
    ] }));
    const report = await readWorkspaceToolchain(root, { detected: true, version: "1.13.2-rc.1" });
    expect(report.map((finding) => finding.id)).toEqual(["openspec-version-pin", "instruction-pin:missing.md", "instruction-pin:other/secret.md"]);
    expect(JSON.stringify(report)).not.toContain("Owner data");
    await writeFile(path.join(root, "AGENTS.md"), "Changed.\n");
    expect((await readWorkspaceToolchain(root, { detected: true, version: "1.13.2" }))[0]?.statement)
      .toContain("Instruction fingerprint differs for AGENTS.md");
    await writeFile(config, JSON.stringify({ instructions: [{ path: "../outside/secret.md", sha256 }] }));
    expect((await readWorkspaceToolchain(root, { detected: true }))[0]?.id).toBe("toolchain-declaration");
  } finally {
    await rm(area, { recursive: true, force: true, maxRetries: 4, retryDelay: 100 });
  }
});
