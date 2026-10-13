import { readdir } from "node:fs/promises";
import path from "node:path";
import type { GitWrapper } from "./git.js";

const CHANGES = "openspec/changes";
const ARCHIVE = `${CHANGES}/archive`;
const DATE_PREFIX = /^\d{4}-\d{2}-\d{2}-/u;

/** A change this pull request puts back among the active ones although the base already archived it. */
export interface ResurrectedChange {
    changeName: string;
    /** The base's archive directory, `<date>-<change>`. */
    archivedAs: string;
}

/** The active changes here that the base does not have active but does have archived.
 * A change the base still has active is not named: archiving it is what such a pull request is for.
 * Throws where `ref` cannot be read: a comparison that could not be made found nothing out. */
export async function readResurrectedChanges(
    workspaceRoot: string,
    ref: string,
    git: Pick<GitWrapper, "listTreeNames">,
): Promise<ResurrectedChange[]> {
    const activeOnBase = new Set((await git.listTreeNames(ref, CHANGES)).filter((name) => name !== "archive"));
    const archivedOnBase = new Map<string, string>();
    for (const name of await git.listTreeNames(ref, ARCHIVE)) archivedOnBase.set(name.replace(DATE_PREFIX, ""), name);

    let here: string[];
    try {
        here = (await readdir(path.join(workspaceRoot, CHANGES), { withFileTypes: true }))
            .filter((entry) => entry.isDirectory() && entry.name !== "archive")
            .map((entry) => entry.name);
    } catch {
        return [];
    }

    return here
        .filter((name) => !activeOnBase.has(name) && archivedOnBase.has(name))
        .sort()
        .map((name) => ({ changeName: name, archivedAs: archivedOnBase.get(name) as string }));
}
