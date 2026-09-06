// Renders the relation changes state about each other — the half of
// `change-dependency-graph` that answers "why is this number here",
// where the check answers "is this edge real".
//
// Reads through `check-change-graph.mjs` rather than parsing the metadata
// a second time. The proposal put this command in `@openspec-ui/cli` on
// the precedent `release-manifest` set; it lives here instead because
// that would have meant a second copy of the parser — `scripts/` runs
// before any build and carries no dependencies, while the CLI package is
// published and compiled. One reader, two entry points.
//
//   node scripts/change-graph.mjs                  the whole graph
//   node scripts/change-graph.mjs --change <id>     one change's ancestry
//   node scripts/change-graph.mjs --all             include isolated changes

import path from "node:path";
import { fileURLToPath } from "node:url";
import { readChangeGraph } from "./check-change-graph.mjs";

const UNREACHABLE_HEADING = "Not reachable from any root, which a cycle causes:";

function label(node) {
    return node.archived ? `${node.id} (archived)` : node.id;
}

/** Children keyed by the change they follow. `supersedes` is not a
 * parent: it says this change corrected a decision, not that it grew out
 * of one, and threading both into the same tree would claim an order the
 * repository never stated. It is printed as an annotation instead. */
function childrenByParent(nodes) {
    const children = new Map();
    for (const node of nodes.values()) {
        for (const parent of node.follows) {
            if (!children.has(parent)) children.set(parent, []);
            children.get(parent).push(node.id);
        }
    }
    for (const list of children.values()) list.sort();
    return children;
}

function connected(nodes, children) {
    return [...nodes.values()].filter(
        (node) => node.follows.length > 0 || node.supersedes.length > 0 || (children.get(node.id)?.length ?? 0) > 0,
    );
}

export function renderTree(nodes, { all = false } = {}) {
    const children = childrenByParent(nodes);
    const shown = all ? [...nodes.values()] : connected(nodes, children);
    const shownIds = new Set(shown.map((node) => node.id));

    // A root here is a change that follows nothing. Not "the oldest" —
    // the archive's date prefix is when a change closed, not when it
    // started, and reading order off it is the mistake this whole change
    // exists to stop.
    const roots = shown.filter((node) => node.follows.length === 0).map((node) => node.id).sort();

    const lines = [];
    const printed = new Set();
    const walk = (id, depth, seen) => {
        const node = nodes.get(id);
        if (!node) return;
        printed.add(id);
        const annotations = node.supersedes.length > 0 ? `  [supersedes ${node.supersedes.join(", ")}]` : "";
        lines.push(`${"  ".repeat(depth)}${depth === 0 ? "" : "└ "}${label(node)}${annotations}`);
        if (seen.has(id)) {
            lines.push(`${"  ".repeat(depth + 1)}└ (cycle back to ${id})`);
            return;
        }
        for (const child of children.get(id) ?? []) {
            // A change with more than one parent appears under each. The
            // relation is a DAG; this is a rendering of it, and one that
            // silently dropped an edge would be worse than the flat list.
            if (shownIds.has(child)) walk(child, depth + 1, new Set([...seen, id]));
        }
    };
    for (const root of roots) walk(root, 0, new Set());

    // Everything in a cycle follows something, so none of it is a root and
    // none of it would be printed — the whole subgraph would vanish and
    // this would report that no relation exists. The check fails on a
    // cycle; a renderer that hides one is worse than one that shows it
    // awkwardly.
    for (const id of shown.map((node) => node.id).sort()) {
        if (printed.has(id)) continue;
        if (!lines.includes(UNREACHABLE_HEADING)) lines.push(UNREACHABLE_HEADING);
        walk(id, 1, new Set());
    }

    if (lines.length === 0) lines.push("No change states a relation yet.");
    return lines.join("\n");
}

/** Walks `follows` upward from one change — from a decision back to the
 * reason for it, which is the question that motivated this. */
export function renderAncestry(nodes, id) {
    const start = nodes.get(id);
    if (!start) return `No change with id "${id}", active or archived.`;

    const lines = [];
    const walk = (current, depth, seen) => {
        const node = nodes.get(current);
        if (!node) {
            lines.push(`${"  ".repeat(depth)}${depth === 0 ? "" : "↑ "}${current} (missing)`);
            return;
        }
        const annotations = node.supersedes.length > 0 ? `  [supersedes ${node.supersedes.join(", ")}]` : "";
        lines.push(`${"  ".repeat(depth)}${depth === 0 ? "" : "↑ "}${label(node)}${annotations}`);
        if (seen.has(current)) {
            lines.push(`${"  ".repeat(depth + 1)}↑ (cycle back to ${current})`);
            return;
        }
        for (const parent of node.follows) walk(parent, depth + 1, new Set([...seen, current]));
    };
    walk(id, 0, new Set());

    if (lines.length === 1) lines.push("  (follows nothing)");
    return lines.join("\n");
}

async function main(argv) {
    const root = process.cwd();
    const changeIndex = argv.indexOf("--change");
    const nodes = await readChangeGraph(root);

    if (changeIndex >= 0) {
        const id = argv[changeIndex + 1];
        if (!id) {
            console.error("change-graph: --change requires a change id");
            process.exitCode = 2;
            return;
        }
        console.log(renderAncestry(nodes, id));
        return;
    }
    console.log(renderTree(nodes, { all: argv.includes("--all") }));
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
    await main(process.argv.slice(2));
}
