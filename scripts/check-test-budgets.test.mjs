import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
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
