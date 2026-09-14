// Fails the lint gate when `openspec/config.yaml` does not parse, or parses
// without the keys that carry this repository's rules.
//
// `openspec` does not fail on a config it cannot parse. It warns once and
// ignores the file, so every proposal and apply goes on without the
// invariants and rules the file holds. One list item with `: ` inside a
// plain scalar did exactly that from 2026-09-10 until
// openspec-config-parses-again, and every check stayed green.

import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { parseDocument } from "yaml";

export const CONFIG_PATH = "openspec/config.yaml";

/** The top-level keys whose absence means the rules do not reach a run. */
export const REQUIRED_KEYS = ["schema", "context", "rules", "operations"];

/** Every reason the text is not a config that carries the rules, each
 * naming its line where the parser gives one. Empty when it is. */
export function checkOpenSpecConfig(text) {
    const doc = parseDocument(text, { prettyErrors: true });
    if (doc.errors.length > 0) {
        return doc.errors.map((error) => {
            const line = error.linePos?.[0]?.line;
            const first = String(error.message).split(/\r?\n/u)[0];
            return line !== undefined ? `${CONFIG_PATH}:${line}: ${first}` : `${CONFIG_PATH}: ${first}`;
        });
    }
    const value = doc.toJS();
    if (typeof value !== "object" || value === null || Array.isArray(value)) {
        return [`${CONFIG_PATH}: expected a mapping at the top level`];
    }
    return REQUIRED_KEYS
        .filter((key) => !(key in value))
        .map((key) => `${CONFIG_PATH}: the top-level key "${key}" is missing`);
}

async function main() {
    const root = process.cwd();
    const problems = checkOpenSpecConfig(await readFile(path.join(root, CONFIG_PATH), "utf8"));
    if (problems.length === 0) {
        console.log("OpenSpec config check passed.");
        return;
    }
    for (const problem of problems) console.error(problem);
    console.error(`OpenSpec config check failed with ${problems.length} problem(s).`);
    process.exitCode = 1;
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
    await main();
}
