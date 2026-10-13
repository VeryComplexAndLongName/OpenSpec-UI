import { mkdir, mkdtemp, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { GitWorktree } from "./git.js";
import { changeLogsRoot, listChangeRunLogs, readChangeRunLog } from "./change-run-logs.js";
import { createFileRunLogs } from "./run-log.js";

// a-change-shows-the-logs-of-its-own-worktree. Real log files in a temporary
// repository and worktree; only the worktree list is supplied.

// every-varying-check-has-a-budget: temporary files only, no process.
// Measured 2026-10-13 at under 1 s for the file on this machine.
vi.setConfig({ testTimeout: 15_000 });

let base: string;
let host: string;
let own: string;

const worktrees = (entries: GitWorktree[]) => ({ worktreeList: async () => entries });

async function logRun(root: string, runId: string, changeName: string): Promise<void> {
    await createFileRunLogs(root)
        .open({ runId, agent: "claude-cli", kind: "implement", cwd: root, changeName })
        .end({ outcome: "completed" });
}

beforeEach(async () => {
    base = await mkdtemp(path.join(os.tmpdir(), "change-run-logs-"));
    host = path.join(base, "repo");
    own = path.join(base, "worktrees", "demo");
    await mkdir(path.join(own, "openspec", "changes", "demo"), { recursive: true });
    await mkdir(host, { recursive: true });
    await (await import("node:fs/promises")).writeFile(path.join(own, "openspec", "changes", "demo", "tasks.md"), "- [ ] 1.1 x\n");
});

afterEach(async () => {
    await rm(base, { recursive: true, force: true });
});

const listed = (): GitWorktree[] => [
    { path: host, branch: "main", head: "a" },
    { path: own, branch: "demo", head: "b" },
];

describe("a change's run logs", () => {
    it("lists the logs of its own worktree where the host's root kept none", async () => {
        await logRun(own, "run-1", "demo");
        await logRun(own, "run-2", "demo");

        const found = await listChangeRunLogs({ repositoryRoot: host, changeName: "demo", git: worktrees(listed()) });

        expect(found.map((one) => one.runId).sort()).toEqual(["run-1", "run-2"]);
    });

    it("reads a run's log where the list found it", async () => {
        await logRun(own, "run-1", "demo");

        const records = await readChangeRunLog({ repositoryRoot: host, changeName: "demo", runId: "run-1", git: worktrees(listed()) });

        expect(records?.[0]).toMatchObject({ type: "start", changeName: "demo" });
    });

    it("falls back to the host's root for a change with no worktree of its own", async () => {
        await logRun(host, "run-9", "other");

        const root = await changeLogsRoot({ repositoryRoot: host, changeName: "other", git: worktrees([{ path: host, branch: "main", head: "a" }]) });
        const found = await listChangeRunLogs({ repositoryRoot: host, changeName: "other", git: worktrees([{ path: host, branch: "main", head: "a" }]) });

        expect(root).toBe(host);
        expect(found.map((one) => one.runId)).toEqual(["run-9"]);
    });

    it("falls back to the host's root where the worktree list cannot be read", async () => {
        const broken = { worktreeList: async () => { throw new Error("not a repository"); } };

        expect(await changeLogsRoot({ repositoryRoot: host, changeName: "demo", git: broken })).toBe(host);
    });

    it("does not read a run id that could name a file outside the directory", async () => {
        expect(await readChangeRunLog({ repositoryRoot: host, changeName: "demo", runId: "../audit", git: worktrees(listed()) })).toBeUndefined();
    });
});
