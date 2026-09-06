import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { analyzeTestFile, scanTrackedTestFiles } from "./check-test-budgets.mjs";

test("analyzeTestFile marks cost-varying test with budget as compliant", () => {
    const source = [
        'import { mkdtemp } from "node:fs/promises";',
        'import { it, vi } from "vitest";',
        'vi.setConfig({ testTimeout: 20000 });',
        'it("works", async () => { await mkdtemp("x"); });',
    ].join("\n");
    const result = analyzeTestFile("x.test.ts", source);
    assert.equal(result.costVarying, true);
    assert.equal(result.hasBudget, true);
});

test("scanTrackedTestFiles reports missing budget by file path", async () => {
    const root = await mkdtemp(path.join(os.tmpdir(), "openspec-budget-policy-"));
    try {
        execFileSync("git", ["init"], { cwd: root, stdio: "ignore" });
        await writeFile(
            path.join(root, "a.test.ts"),
            'import { mkdtemp } from "node:fs/promises";\nimport { it } from "vitest";\nit("x", async () => { await mkdtemp("x"); });\n',
            "utf8",
        );
        execFileSync("git", ["add", "a.test.ts"], { cwd: root, stdio: "ignore" });

        const violations = await scanTrackedTestFiles(root, new Map());
        assert.equal(violations.length, 1);
        assert.equal(violations[0]?.filePath, "a.test.ts");
    } finally {
        await rm(root, { recursive: true, force: true });
    }
});

test("scanTrackedTestFiles accepts explicit baseline exemption", async () => {
    const root = await mkdtemp(path.join(os.tmpdir(), "openspec-budget-policy-"));
    try {
        execFileSync("git", ["init"], { cwd: root, stdio: "ignore" });
        await writeFile(
            path.join(root, "a.test.ts"),
            'import { mkdtemp } from "node:fs/promises";\nimport { it } from "vitest";\nit("x", async () => { await mkdtemp("x"); });\n',
            "utf8",
        );
        execFileSync("git", ["add", "a.test.ts"], { cwd: root, stdio: "ignore" });

        const baseline = new Map([["a.test.ts", "reason"]]);
        const violations = await scanTrackedTestFiles(root, baseline);
        assert.deepEqual(violations, []);
    } finally {
        await rm(root, { recursive: true, force: true });
    }
});

test("a call that merely ends in \"it(\" is not a budget", () => {
    // `child.emit("close", 0)` reads as `it("close", 0)` to a regular
    // expression, which is how `server.test.ts` passed this gate on an
    // unrelated line rather than on the budgets it had been given.
    const source = [
        'import { mkdtemp } from "node:fs/promises";',
        'import { it } from "vitest";',
        'it("x", async () => { child.emit("close", 0); await mkdtemp("x"); });',
    ].join("\n");
    const result = analyzeTestFile("x.test.ts", source);
    assert.equal(result.costVarying, true);
    assert.equal(result.hasBudget, false);
});

test("a per-test timeout on its own line is a budget", () => {
    const source = [
        'import { mkdtemp } from "node:fs/promises";',
        'import { it } from "vitest";',
        'it("x", async () => {',
        '  await mkdtemp("x");',
        '}, 20_000);',
    ].join("\n");
    assert.equal(analyzeTestFile("x.test.ts", source).hasBudget, true);
});

test("a setTimeout delay is not a budget", () => {
    const source = [
        'import { mkdtemp } from "node:fs/promises";',
        'import { it } from "vitest";',
        'it("x", async () => {',
        '  await new Promise((r) => setTimeout(r, 10));',
        '  await mkdtemp("x");',
        '});',
    ].join("\n");
    assert.equal(analyzeTestFile("x.test.ts", source).hasBudget, false);
});

test("a spawned process makes a test cost-varying", () => {
    const source = [
        'import { spawn } from "node:child_process";',
        'import { it } from "vitest";',
        'it("x", async () => { spawn("git", ["status"]); });',
    ].join("\n");
    assert.equal(analyzeTestFile("x.test.ts", source).costVarying, true);
});

async function repoWith(files) {
    const root = await mkdtemp(path.join(os.tmpdir(), "openspec-budget-policy-"));
    execFileSync("git", ["init"], { cwd: root, stdio: "ignore" });
    for (const [relative, content] of Object.entries(files)) {
        const full = path.join(root, relative);
        await mkdir(path.dirname(full), { recursive: true });
        await writeFile(full, content, "utf8");
    }
    execFileSync("git", ["add", "-A"], { cwd: root, stdio: "ignore" });
    return root;
}

const BUDGETED_TEST_WITH_CLEANUP_HOOK = [
    'import { mkdtemp, rm } from "node:fs/promises";',
    'import { afterEach, it, vi } from "vitest";',
    "vi.setConfig({ testTimeout: 20000 });",
    "afterEach(async () => {",
    '  await rm("dir", { recursive: true, force: true });',
    "});",
    'it("x", async () => { await mkdtemp("x"); });',
].join("\n");

test("a cleanup hook with no project hook budget is reported against the config", async () => {
    // `testTimeout` does not raise `hookTimeout`, so a file can be fully
    // budgeted and still have its cleanup on the 10000 ms default.
    const root = await repoWith({
        "packages/thing/src/a.test.ts": BUDGETED_TEST_WITH_CLEANUP_HOOK,
        "packages/thing/vitest.config.ts": "export default { test: { exclude: [] } };\n",
    });
    try {
        const violations = await scanTrackedTestFiles(root, new Map());
        assert.equal(violations.length, 1);
        assert.equal(violations[0]?.filePath, "packages/thing/vitest.config.ts");
        assert.match(violations[0]?.reason ?? "", /hookTimeout/u);
    } finally {
        await rm(root, { recursive: true, force: true });
    }
});

test("a project that states a hook budget passes", async () => {
    const root = await repoWith({
        "packages/thing/src/a.test.ts": BUDGETED_TEST_WITH_CLEANUP_HOOK,
        "packages/thing/vitest.config.ts": "export default { test: { hookTimeout: 60_000 } };\n",
    });
    try {
        assert.deepEqual(await scanTrackedTestFiles(root, new Map()), []);
    } finally {
        await rm(root, { recursive: true, force: true });
    }
});

test("a hook that does no filesystem work needs no hook budget", async () => {
    const root = await repoWith({
        "packages/thing/src/a.test.ts": [
            'import { mkdtemp } from "node:fs/promises";',
            'import { beforeEach, it, vi } from "vitest";',
            "vi.setConfig({ testTimeout: 20000 });",
            "beforeEach(() => { counter = 0; });",
            'it("x", async () => { await mkdtemp("x"); });',
        ].join("\n"),
        "packages/thing/vitest.config.ts": "export default { test: { exclude: [] } };\n",
    });
    try {
        assert.deepEqual(await scanTrackedTestFiles(root, new Map()), []);
    } finally {
        await rm(root, { recursive: true, force: true });
    }
});
