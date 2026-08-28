import { mkdir, mkdtemp, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";

/** A minimal, valid OpenSpec workspace with one change -- the same
 * fixture shape standalone.spec.ts already uses, factored out since
 * multiple lifecycle specs need it. */
export async function createLifecycleWorkspace(changeName: string): Promise<string> {
  const workspaceRoot = await mkdtemp(path.join(os.tmpdir(), "openspec-ui-lifecycle-"));
  const changeRoot = path.join(workspaceRoot, "openspec", "changes", changeName);
  await mkdir(path.join(changeRoot, "specs", changeName), { recursive: true });
  await mkdir(path.join(workspaceRoot, "openspec", "specs"), { recursive: true });
  await Promise.all([
    writeFile(path.join(workspaceRoot, "openspec", "config.yaml"), "schema: spec-driven\n", "utf8"),
    writeFile(path.join(changeRoot, ".openspec.yaml"), "schema: spec-driven\n", "utf8"),
    writeFile(path.join(changeRoot, "proposal.md"), "## Why\n\nLifecycle fixture.\n", "utf8"),
    writeFile(path.join(changeRoot, "design.md"), "## Context\n\nLifecycle fixture.\n", "utf8"),
    writeFile(path.join(changeRoot, "tasks.md"), "## Tasks\n\n- [ ] Lifecycle run\n", "utf8"),
    writeFile(
      path.join(changeRoot, "specs", changeName, "spec.md"),
      "## ADDED Requirements\n\n### Requirement: Lifecycle fixture\nThe system SHALL load.\n",
      "utf8",
    ),
  ]);
  return workspaceRoot;
}
