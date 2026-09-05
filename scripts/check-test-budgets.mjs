// Fails the lint gate when a test whose cost varies with the machine
// states no time budget — the mechanical half of `quality-gates`'
// "A check whose cost varies with the machine states its own budget",
// which was otherwise a paragraph no check read.
//
// Walks git-tracked files, as `check-english.mjs` does, so a new file
// must be staged before this check can see it.

import { spawnSync } from "node:child_process";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const TEST_FILE_PATTERN = /\.test\.(ts|tsx|mjs)$/u;

const EXCLUDED_PREFIXES = [
    "node_modules/",
    "dist/",
    ".git/",
    "openspec/changes/archive/",
    // Not vitest: `scripts/*.test.mjs` run under `node --test`, and
    // `packages/extension/src/test/suite/` runs inside a real VS Code
    // Extension Development Host. Neither has a vitest budget to state.
    "scripts/",
    "packages/extension/src/test/suite/",
];

const BASELINE_PATH = "scripts/test-budget-baseline.json";

// What makes a test's duration depend on how busy the machine is:
// filesystem work, a spawned process, or a fixture that is built rather
// than declared. Matching one of these is a reason to look, not proof —
// a file that mocks the module away is exempted by the baseline with
// that reason recorded.
const COST_SIGNALS = [
    /from\s+"node:fs(\/promises)?"/u,
    /from\s+"node:child_process"/u,
    /from\s+"simple-git"/u,
    /from\s+"esbuild"/u,
    /\bmkdtemp(Sync)?\s*\(/u,
    /\bcaptureCheckpoint\b/u,
    /\bfinalizeCheckpoint\b/u,
    /\brollbackCheckpoint\b/u,
    /\bWorkbenchRunJournal\b/u,
];

const FILE_BUDGET = /\bvi\.setConfig\s*\(\s*\{[^}]*\b(testTimeout|hookTimeout)\s*:/su;

const TEST_CALL = /(^|[^\w$.])(it|test|beforeAll|afterAll|beforeEach|afterEach)\s*\(/gu;

/** Walks forward from an opening parenthesis to its match, skipping
 * strings, template literals, regular expressions' simpler forms and
 * comments, and returns the source offsets of the commas that sit at the
 * call's own nesting depth.
 *
 * A regular expression cannot do this. The previous version of this
 * check tried, and matched `child.emit("close", 0)` as a stated budget —
 * `emit(` ends in `it(` — which is why `server.test.ts` passed the gate
 * on an unrelated line rather than on the budgets it had just been
 * given. */
function callArguments(source, openParen) {
    let depth = 0;
    const commas = [];
    for (let i = openParen; i < source.length; i += 1) {
        const c = source[i];
        const next = source[i + 1];
        if (c === "/" && next === "/") {
            i = source.indexOf("\n", i);
            if (i === -1) break;
            continue;
        }
        if (c === "/" && next === "*") {
            const end = source.indexOf("*/", i + 2);
            if (end === -1) break;
            i = end + 1;
            continue;
        }
        if (c === '"' || c === "'" || c === "`") {
            for (i += 1; i < source.length; i += 1) {
                if (source[i] === "\\") i += 1;
                else if (source[i] === c) break;
            }
            continue;
        }
        if (c === "(" || c === "[" || c === "{") depth += 1;
        else if (c === ")" || c === "]" || c === "}") {
            depth -= 1;
            if (depth === 0) return { commas, close: i };
        } else if (c === "," && depth === 1) commas.push(i);
    }
    return undefined;
}

/** True when a test or hook call passes a numeric literal as its last
 * argument — vitest's per-test timeout. */
function hasInlineBudget(source) {
    TEST_CALL.lastIndex = 0;
    let match;
    while ((match = TEST_CALL.exec(source)) !== null) {
        const openParen = match.index + match[0].length - 1;
        const call = callArguments(source, openParen);
        if (!call || call.commas.length === 0) continue;
        const last = source.slice(call.commas.at(-1) + 1, call.close);
        if (/^\s*\d[\d_]*\s*$/u.test(last)) return true;
    }
    return false;
}

function trackedFiles(root) {
    const result = spawnSync("git", ["ls-files", "-z"], {
        cwd: root,
        encoding: "utf8",
        windowsHide: true,
    });
    if (result.status !== 0) {
        throw new Error(`git ls-files failed: ${result.stderr.trim() || "unknown error"}`);
    }
    return result.stdout.split("\0").filter(Boolean);
}

async function readBaseline(root) {
    try {
        const raw = JSON.parse(await readFile(path.join(root, BASELINE_PATH), "utf8"));
        const list = Array.isArray(raw?.exemptions) ? raw.exemptions : [];
        const map = new Map();
        for (const entry of list) {
            if (entry && typeof entry.filePath === "string" && typeof entry.reason === "string") {
                map.set(entry.filePath, entry.reason);
            }
        }
        return map;
    } catch (error) {
        if (error && typeof error === "object" && "code" in error && error.code === "ENOENT") return new Map();
        throw error;
    }
}

export function analyzeTestFile(filePath, source) {
    const costVarying = COST_SIGNALS.some((signal) => signal.test(source));
    const hasBudget = FILE_BUDGET.test(source) || hasInlineBudget(source);
    return { filePath, costVarying, hasBudget };
}

export async function scanTrackedTestFiles(root, baselineMap) {
    const baseline = baselineMap ?? await readBaseline(root);
    const violations = [];
    for (const file of trackedFiles(root)) {
        const normalized = file.replaceAll("\\", "/");
        if (!TEST_FILE_PATTERN.test(normalized)
            || EXCLUDED_PREFIXES.some((prefix) => normalized.startsWith(prefix))) continue;
        const source = await readFile(path.join(root, file), "utf8");
        const analyzed = analyzeTestFile(normalized, source);
        if (!analyzed.costVarying || analyzed.hasBudget) continue;
        if (baseline.get(normalized)) continue;
        violations.push({
            filePath: normalized,
            reason: "cost-varying test states no time budget:"
                + " add vi.setConfig({ testTimeout }) or a per-test timeout,"
                + " sized from a measurement recorded beside it",
        });
    }
    return violations;
}

async function main() {
    const root = process.cwd();
    const violations = await scanTrackedTestFiles(root);
    if (violations.length === 0) {
        console.log("Test budget policy check passed.");
        return;
    }
    for (const violation of violations) {
        console.error(`${violation.filePath}: ${violation.reason}`);
    }
    console.error(`Test budget policy check failed with ${violations.length} violation(s).`);
    process.exitCode = 1;
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
    await main();
}
