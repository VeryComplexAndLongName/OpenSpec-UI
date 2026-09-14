import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";
import { CONFIG_PATH, checkOpenSpecConfig } from "./check-openspec-config.mjs";

// openspec-config-parses-again: `openspec` ignores a config it cannot parse
// and carries on, so the only place a broken one shows is this check.

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

const CONFIG = [
    "schema: spec-driven",
    "context: |",
    "  The invariants.",
    "rules:",
    "  tasks:",
    "    - >-",
    "      Which marking depends on why: `**Human-only**` where no agent can",
    "      make the check.",
    "operations:",
    "  apply:",
    "    guidance:",
    "      - Run the checks.",
    "",
].join("\n");

test("checkOpenSpecConfig accepts a config whose rules parse", () => {
    assert.deepEqual(checkOpenSpecConfig(CONFIG), []);
});

test("checkOpenSpecConfig refuses a list item with ': ' inside a plain scalar, naming the line", () => {
    // The shape that broke the file on 2026-09-10: a colon and a space in
    // the middle of a plain, multi-line list item.
    const broken = CONFIG.replace("    - >-\n      Which", "    - Which");
    const problems = checkOpenSpecConfig(broken);
    assert.ok(problems.length > 0);
    assert.match(problems[0] ?? "", /^openspec\/config\.yaml:\d+: /u);
});

test("checkOpenSpecConfig names a missing top-level key", () => {
    const withoutRules = CONFIG.replace(/rules:[\s\S]*?(?=operations:)/u, "");
    assert.deepEqual(checkOpenSpecConfig(withoutRules), [`${CONFIG_PATH}: the top-level key "rules" is missing`]);
});

test("the repository's own config parses and carries every required key", async () => {
    const text = await readFile(path.join(ROOT, CONFIG_PATH), "utf8");
    assert.deepEqual(checkOpenSpecConfig(text), []);
});
