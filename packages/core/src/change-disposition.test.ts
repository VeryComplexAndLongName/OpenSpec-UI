import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { expect, it, vi } from "vitest";
import { readChangeDisposition, setChangeDisposition } from "./change-disposition.js";
import { readChangeReadiness } from "./change-readiness.js";
import { resolveChainStart } from "./chain-preflight.js";
import { buildHints } from "./hints.js";
import { archiveChange } from "./openspec.js";

// The real file and repository probes took under one second on Windows.
// Allow for contention when CI runs the filesystem cases together.
vi.setConfig({ testTimeout: 20_000 });

it("keeps history and files while holding a change, requires a current decision, and refuses a chain or archive", async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), "osw-disposition-"));
  try {
    const dir = path.join(root, "openspec", "changes", "example");
    const spec = path.join(root, "openspec", "specs", "feature", "spec.md");
    await mkdir(dir, { recursive: true });
    await mkdir(path.dirname(spec), { recursive: true });
    await writeFile(path.join(root, "openspec", "config.yaml"), "schema: spec-driven\n");
    await writeFile(path.join(dir, "proposal.md"), "Proposal stays here.\n");
    await writeFile(spec, "Stable specification.\n");
    const empty = await readChangeDisposition(root, "example");
    const deferred = await setChangeDisposition(root, "example", { revision: empty.revision, state: "deferred", reason: "Waiting for input" });
    const cancelled = await setChangeDisposition(root, "example", { revision: deferred.revision, state: "cancelled", reason: "Another change may replace it" });
    await expect(setChangeDisposition(root, "example", { revision: deferred.revision, state: "active", reason: "Stale update" }))
      .rejects.toThrow("disposition changed");

    const report = await readChangeReadiness({ workspaceRoot: root, statuses: [] });
    expect(report.changes).toMatchObject([{ changeName: "example", disposition: { state: "cancelled" } }]);
    expect(buildHints(report)).toEqual([]);
    const resolveRunner = vi.fn();
    await expect(resolveChainStart({ workspaceRoot: root, changeName: "example", canAnswerCheckpoints: true, resolveRunner }))
      .resolves.toMatchObject({ ok: false, refusal: { code: "OSW-HRN-129" } });
    expect(resolveRunner).not.toHaveBeenCalled();
    await expect(archiveChange("example", { cwd: root })).rejects.toThrow("Restore the cancelled change");

    const restored = await setChangeDisposition(root, "example", { revision: cancelled.revision, state: "active", reason: "Ready to resume" });
    expect(restored.history.map((event) => event.state)).toEqual(["deferred", "cancelled", "active"]);
    expect(await readFile(path.join(dir, "proposal.md"), "utf8")).toBe("Proposal stays here.\n");
    expect(await readFile(spec, "utf8")).toBe("Stable specification.\n");
  } finally {
    await rm(root, { recursive: true, force: true, maxRetries: 10, retryDelay: 100 });
  }
});
