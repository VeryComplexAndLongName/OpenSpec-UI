// Verifies the relation changes state about each other — the mechanical
// half of `quality-gates`' "A stated relation between changes is
// verified, not trusted".
//
// `openspec change validate --strict` accepts unknown keys in
// `.openspec.yaml` and ignores them: a probe naming a change that does
// not exist validated clean. So a `follows`/`supersedes` edge is only as
// good as this check, and a successor that was named but never created
// would otherwise be discoverable solely by someone reading prose.
//
// No dependencies, matching `check-english.mjs` and
// `check-test-budgets.mjs`. The two keys are read with a narrow parser
// rather than a YAML library, and a key present in a shape this does not
// accept is reported rather than guessed at — a misread edge is worse
// than a missing one.

import { readdir, readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const CHANGES_DIR = "openspec/changes";
const ARCHIVE_DIR = "openspec/changes/archive";
const RELATION_KEYS = ["follows", "supersedes"];

/** `openspec archive` renames `<id>` to `<YYYY-MM-DD>-<id>`. An edge
 * names the id, so archiving must never break one — most edges point at
 * archived work, which is where their value is. */
const ARCHIVE_PREFIX = /^\d{4}-\d{2}-\d{2}-/u;

const CHANGE_ID = /^[A-Za-z0-9][A-Za-z0-9._-]*$/u;

/** Reads the two relation keys, and only those. Accepted shapes:
 *
 *     follows: one-change-id
 *     follows: [first, second]
 *     follows:
 *       - first
 *       - second
 *
 * A key present in any other shape yields an error rather than an empty
 * list, so an unreadable edge fails loudly instead of reading as absent.
 */
export function parseRelations(source) {
    const relations = { follows: [], supersedes: [] };
    const errors = [];
    const lines = source.split(/\r?\n/u);

    for (let i = 0; i < lines.length; i += 1) {
        if (/^\s*#/u.test(lines[i])) continue;
        const match = /^(follows|supersedes)\s*:(.*)$/u.exec(lines[i]);
        if (!match) {
            // A key that does not start its line is not a key. Several of
            // these files end without a trailing newline, so appending
            // `follows:` to one yields `created: 2026-09-04follows:` —
            // valid-looking, silently ignored by every reader. Caught here
            // rather than left to read as "no edge stated".
            if (/\S(follows|supersedes)\s*:/u.test(lines[i])) {
                errors.push(`line ${i + 1}: a relation key must start its own line, found ${JSON.stringify(lines[i].trim())}`);
            }
            continue;
        }
        const key = match[1];
        const rest = match[2].replace(/#.*$/u, "").trim();

        let values;
        if (rest.startsWith("[")) {
            if (!rest.endsWith("]")) {
                errors.push(`${key}: a flow sequence must open and close on one line`);
                continue;
            }
            values = rest.slice(1, -1).split(",").map((value) => value.trim()).filter(Boolean);
        } else if (rest.length > 0) {
            values = [rest];
        } else {
            values = [];
            for (let j = i + 1; j < lines.length; j += 1) {
                const item = /^\s+-\s*(.+?)\s*$/u.exec(lines[j]);
                if (!item) {
                    if (lines[j].trim() === "" || /^\s*#/u.test(lines[j])) continue;
                    break;
                }
                values.push(item[1].replace(/#.*$/u, "").trim());
                i = j;
            }
            if (values.length === 0) {
                errors.push(`${key}: stated with no value — remove the key or name a change`);
                continue;
            }
        }

        for (const value of values) {
            const id = value.replace(/^["']|["']$/gu, "");
            if (!CHANGE_ID.test(id)) {
                errors.push(`${key}: ${JSON.stringify(id)} is not a change id`);
                continue;
            }
            relations[key].push(id);
        }
    }

    return { ...relations, errors };
}

async function directories(root, relative) {
    try {
        const entries = await readdir(path.join(root, relative), { withFileTypes: true });
        return entries.filter((entry) => entry.isDirectory()).map((entry) => entry.name);
    } catch (error) {
        if (error && typeof error === "object" && "code" in error && error.code === "ENOENT") return [];
        throw error;
    }
}

/** Every change this repository knows about, active or archived, keyed by
 * the id an edge would name. */
export async function readChangeGraph(root) {
    const nodes = new Map();

    for (const name of await directories(root, CHANGES_DIR)) {
        if (name === "archive") continue;
        nodes.set(name, { id: name, archived: false, metadataPath: `${CHANGES_DIR}/${name}/.openspec.yaml` });
    }
    for (const name of await directories(root, ARCHIVE_DIR)) {
        const id = name.replace(ARCHIVE_PREFIX, "");
        // An active change of the same id wins: it is the one being
        // worked on, and its metadata is the one an author edits.
        if (!nodes.has(id)) {
            nodes.set(id, { id, archived: true, metadataPath: `${ARCHIVE_DIR}/${name}/.openspec.yaml` });
        }
    }

    for (const node of nodes.values()) {
        let source;
        try {
            source = await readFile(path.join(root, node.metadataPath), "utf8");
        } catch (error) {
            if (!error || typeof error !== "object" || !("code" in error) || error.code !== "ENOENT") throw error;
            source = "";
        }
        const parsed = parseRelations(source);
        node.follows = parsed.follows;
        node.supersedes = parsed.supersedes;
        node.errors = parsed.errors;
    }

    return nodes;
}

function edgesOf(node) {
    return [...node.follows, ...node.supersedes];
}

/** Depth-first, three-colour. Reports the changes in each cycle rather
 * than only that one exists — a cycle among archived work is not
 * something a reader can find by eye. */
function findCycles(nodes) {
    const state = new Map();
    const stack = [];
    const cycles = [];

    function visit(id) {
        const node = nodes.get(id);
        if (!node || state.get(id) === "done") return;
        if (state.get(id) === "open") {
            cycles.push([...stack.slice(stack.indexOf(id)), id]);
            return;
        }
        state.set(id, "open");
        stack.push(id);
        for (const next of edgesOf(node)) visit(next);
        stack.pop();
        state.set(id, "done");
    }

    for (const id of [...nodes.keys()].sort()) visit(id);
    return cycles;
}

export async function checkChangeGraph(root) {
    const nodes = await readChangeGraph(root);
    const violations = [];

    for (const node of [...nodes.values()].sort((a, b) => a.id.localeCompare(b.id))) {
        for (const message of node.errors) {
            violations.push({ filePath: node.metadataPath, reason: message });
        }
        for (const key of RELATION_KEYS) {
            for (const target of node[key]) {
                if (nodes.has(target)) continue;
                violations.push({
                    filePath: node.metadataPath,
                    reason: `${key}: ${JSON.stringify(target)} matches no change, active or archived`
                        + " — a successor that was named but never created is what this check exists to catch",
                });
            }
        }
    }

    for (const cycle of findCycles(nodes)) {
        violations.push({
            filePath: nodes.get(cycle[0])?.metadataPath ?? `${CHANGES_DIR}/${cycle[0]}/.openspec.yaml`,
            reason: `the stated relations form a cycle: ${cycle.join(" -> ")}`,
        });
    }

    return violations;
}

async function main() {
    const violations = await checkChangeGraph(process.cwd());
    if (violations.length === 0) {
        console.log("Change graph check passed.");
        return;
    }
    for (const violation of violations) {
        console.error(`${violation.filePath}: ${violation.reason}`);
    }
    console.error(`Change graph check failed with ${violations.length} violation(s).`);
    process.exitCode = 1;
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
    await main();
}
