import { spawnSync } from "node:child_process";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const TEST_FILE_PATTERN = /\.test\.(ts|tsx|mjs)$/u;
const EXCLUDED_PREFIXES = ["node_modules/", "dist/", ".git/", "openspec/changes/archive/", "scripts/"];
const BASELINE_PATH = "scripts/test-budget-baseline.json";

const COST_SIGNALS = [
    /from\s+"node:fs\/promises"/u,
    /from\s+"simple-git"/u,
    /from\s+"esbuild"/u,
    /\bcaptureCheckpoint\b/u,
    /\bfinalizeCheckpoint\b/u,
    /\brollbackCheckpoint\b/u,
    /\bWorkbenchRunJournal\b/u,
];

const BUDGET_SIGNALS = [
    /vi\.setConfig\(\{\s*testTimeout\s*:/u,
    /vi\.setConfig\(\{\s*hookTimeout\s*:/u,
    /(it|test|beforeAll|afterAll|beforeEach|afterEach)\([^\n]*,\s*\d[\d_]*\)/u,
];

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
    const hasBudget = BUDGET_SIGNALS.some((signal) => signal.test(source));
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
        const reason = baseline.get(normalized);
        if (reason) continue;
        violations.push({
            filePath: normalized,
            reason: "cost-varying test has no explicit timeout budget",
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
