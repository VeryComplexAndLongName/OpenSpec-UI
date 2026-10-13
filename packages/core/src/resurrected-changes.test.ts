import { mkdir, mkdtemp, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";
import { readResurrectedChanges } from "./resurrected-changes.js";

// a-change-is-never-both-active-and-archived. The base is a listing, so no git
// is started: only the two directories the base lists are supplied.

// every-varying-check-has-a-budget: temporary files only, no process.
// Measured 2026-10-13 at under 1 s for the file on this machine.
vi.setConfig({ testTimeout: 15_000 });

const roots: string[] = [];

afterEach(async () => {
    await Promise.all(roots.splice(0).map((root) => rm(root, { recursive: true, force: true }).catch(() => undefined)));
});

async function checkout(active: string[]): Promise<string> {
    const root = await mkdtemp(path.join(os.tmpdir(), "resurrected-"));
    roots.push(root);
    await mkdir(path.join(root, "openspec", "changes", "archive"), { recursive: true });
    for (const name of active) await mkdir(path.join(root, "openspec", "changes", name), { recursive: true });
    return root;
}

function base(active: string[], archived: string[]) {
    return {
        listTreeNames: async (_ref: string, directory: string) => (directory.endsWith("/archive") ? archived : ["archive", ...active]),
    };
}

describe("readResurrectedChanges", () => {
    it("names a change the base archived and this tree has active again", async () => {
        const root = await checkout(["cli-is-visible", "other-work"]);

        const found = await readResurrectedChanges(root, "origin/main", base(["something-else"], ["2026-10-10-cli-is-visible"]));

        expect(found).toEqual([{ changeName: "cli-is-visible", archivedAs: "2026-10-10-cli-is-visible" }]);
    });

    it("does not name a change the base still has active: archiving it is what the pull request is for", async () => {
        // The base has "landing" active; this tree still holds it active while also carrying its archive,
        // as a pull request does in the commit before it removes the active copy.
        const root = await checkout(["landing"]);

        const found = await readResurrectedChanges(root, "origin/main", base(["landing"], ["2026-10-10-landing"]));

        expect(found).toEqual([]);
    });

    it("does not name a new change, or one only an older archive resembles", async () => {
        const root = await checkout(["brand-new", "cli"]);

        const found = await readResurrectedChanges(root, "origin/main", base([], ["2026-10-10-cli-is-visible"]));

        expect(found).toEqual([]);
    });

    it("reads the change's own name, not a date inside it", async () => {
        const root = await checkout(["2026-extra"]);

        const found = await readResurrectedChanges(root, "origin/main", base([], ["2026-10-10-2026-extra"]));

        expect(found).toEqual([{ changeName: "2026-extra", archivedAs: "2026-10-10-2026-extra" }]);
    });

    it("names nothing where this checkout has no changes directory", async () => {
        const root = await mkdtemp(path.join(os.tmpdir(), "resurrected-empty-"));
        roots.push(root);

        expect(await readResurrectedChanges(root, "origin/main", base([], ["2026-10-10-x"]))).toEqual([]);
    });

    it("fails where the base cannot be read, rather than finding nothing", async () => {
        const root = await checkout(["x"]);
        const broken = { listTreeNames: async () => { throw new Error("bad ref"); } };

        await expect(readResurrectedChanges(root, "origin/nope", broken)).rejects.toThrow("bad ref");
    });
});
