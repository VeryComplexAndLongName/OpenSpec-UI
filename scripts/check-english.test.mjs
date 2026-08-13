import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { mkdtemp, mkdir, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { scanText, scanTrackedFiles } from "./check-english.mjs";

test("scanText reports Cyrillic with bounded line diagnostics", () => {
  const source = `// ${"Нарушение"} ${"x".repeat(200)}`; // english-policy-allow: intentional scanner fixture
  const [violation] = scanText("source.ts", source);
  assert.equal(violation?.line, 1);
  assert.ok((violation?.preview.length ?? 0) <= 160);
});

test("scanText accepts an explicitly marked fixture line", () => {
  const source = "const sample = 'Пример'; // english-policy-allow"; // english-policy-allow: intentional scanner fixture
  assert.deepEqual(scanText("fixture.ts", source), []);
});

test("scanText accepts an exact legacy hash but rejects edited legacy text", () => {
  const source = "// Старый комментарий"; // english-policy-allow: intentional scanner fixture
  const violation = scanText("legacy.ts", source)[0];
  assert.ok(violation);
  const hash = createHash("sha256").update(source.trim()).digest("hex");
  const baseline = new Set([`legacy.ts|${hash}`]);
  assert.deepEqual(scanText("legacy.ts", source, baseline), []);
  assert.equal(scanText("legacy.ts", `${source} изменен`, baseline).length, 1); // english-policy-allow: intentional scanner fixture
});

test("scanTrackedFiles scans tracked authored files only", async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), "openspec-english-policy-"));
  try {
    execFileSync("git", ["init"], { cwd: root, stdio: "ignore" });
    await mkdir(path.join(root, "dist"), { recursive: true });
    await writeFile(path.join(root, "clean.md"), "# English\n", "utf8");
    await writeFile(path.join(root, "violation.ts"), "// Нарушение\n", "utf8"); // english-policy-allow: intentional scanner fixture
    await writeFile(path.join(root, "untracked.md"), "# Нарушение\n", "utf8"); // english-policy-allow: intentional scanner fixture
    await writeFile(path.join(root, "dist", "generated.ts"), "// Нарушение\n", "utf8"); // english-policy-allow: intentional scanner fixture
    execFileSync("git", ["add", "clean.md", "violation.ts", "dist/generated.ts"], { cwd: root, stdio: "ignore" });

    const violations = await scanTrackedFiles(root);

    assert.deepEqual(violations.map((violation) => violation.filePath), ["violation.ts"]);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});