import { execFileSync } from "node:child_process";
import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { listChangeRunLogs } from "./change-run-logs.js";
import { createFileRunLogs } from "./run-log.js";

// a-change-shows-the-logs-of-its-own-worktree: the real `git worktree list`,
// which the other file replaces with a list.

let base: string;

const git = (cwd: string, ...args: string[]) => execFileSync("git", args, { cwd, stdio: "pipe" });

beforeEach(async () => {
    base = await mkdtemp(path.join(os.tmpdir(), "change-run-logs-git-"));
});

afterEach(async () => {
    await rm(base, { recursive: true, force: true });
});

describe("a change's run logs, over a real worktree", () => {
    it("finds the logs through a real git worktree list", async () => {
        const repo = path.join(base, "real");
        const own = path.join(base, "real-worktrees", "demo");
        await mkdir(repo, { recursive: true });
        git(repo, "init", "-b", "main");
        git(repo, "-c", "user.name=t", "-c", "user.email=t@t", "commit", "--allow-empty", "-m", "init");
        git(repo, "worktree", "add", own, "-b", "demo");
        await mkdir(path.join(own, "openspec", "changes", "demo"), { recursive: true });
        await writeFile(path.join(own, "openspec", "changes", "demo", "tasks.md"), "- [ ] 1.1 x\n");
        await createFileRunLogs(own)
            .open({ runId: "run-real", agent: "claude-cli", kind: "implement", cwd: own, changeName: "demo" })
            .end({ outcome: "completed" });

        const found = await listChangeRunLogs({ repositoryRoot: repo, changeName: "demo" });

        expect(found.map((one) => one.runId)).toEqual(["run-real"]);
    }, 30_000);
});
