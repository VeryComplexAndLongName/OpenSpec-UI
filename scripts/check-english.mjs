import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const CYRILLIC_PATTERN = /[\u0400-\u04ff]/u;
const ALLOW_MARKER = "english-policy-allow";
const SCANNED_EXTENSIONS = new Set([".md", ".ts", ".tsx", ".js", ".mjs", ".cjs", ".json", ".yaml", ".yml"]);
const EXCLUDED_PREFIXES = ["node_modules/", "dist/", ".git/", ".vscode-test/", "playwright-report/", "test-results/"];
const EXEMPT_PATHS = new Set(["packages/core/src/openspec-fixtures/show.json"]);
const BASELINE_PATH = "scripts/english-policy-baseline.json";

function normalizedLine(line) {
  return line.trim().replace(/\s+/gu, " ");
}

function baselineKey(filePath, line) {
  const hash = createHash("sha256").update(normalizedLine(line)).digest("hex");
  return `${filePath}|${hash}`;
}

export function scanText(filePath, source, baseline = new Set()) {
  const violations = [];
  for (const [index, line] of source.split(/\r?\n/u).entries()) {
    if (!CYRILLIC_PATTERN.test(line)
      || line.includes(ALLOW_MARKER)
      || baseline.has(baselineKey(filePath, line))) continue;
    const normalized = normalizedLine(line);
    violations.push({
      filePath,
      line: index + 1,
      preview: normalized.length <= 160 ? normalized : `${normalized.slice(0, 157)}...`,
    });
  }
  return violations;
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
    const entries = JSON.parse(await readFile(path.join(root, BASELINE_PATH), "utf8"));
    return new Set(entries);
  } catch (error) {
    if (error instanceof SyntaxError) throw new Error(`Invalid English policy baseline: ${BASELINE_PATH}`, { cause: error });
    if (error && typeof error === "object" && "code" in error && error.code === "ENOENT") return new Set();
    throw error;
  }
}

export async function scanTrackedFiles(root, baseline) {
  const allowed = baseline ?? await readBaseline(root);
  const violations = [];
  for (const relativePath of trackedFiles(root)) {
    const normalizedPath = relativePath.replaceAll("\\", "/");
    if (EXEMPT_PATHS.has(normalizedPath)
      || EXCLUDED_PREFIXES.some((prefix) => normalizedPath.startsWith(prefix))
      || !SCANNED_EXTENSIONS.has(path.extname(normalizedPath).toLowerCase())) continue;
    const source = await readFile(path.join(root, relativePath), "utf8");
    violations.push(...scanText(normalizedPath, source, allowed));
  }
  return violations;
}

async function writeBaseline(root) {
  const entries = new Set();
  for (const relativePath of trackedFiles(root)) {
    const normalizedPath = relativePath.replaceAll("\\", "/");
    if (EXEMPT_PATHS.has(normalizedPath)
      || EXCLUDED_PREFIXES.some((prefix) => normalizedPath.startsWith(prefix))
      || !SCANNED_EXTENSIONS.has(path.extname(normalizedPath).toLowerCase())) continue;
    const source = await readFile(path.join(root, relativePath), "utf8");
    for (const line of source.split(/\r?\n/u)) {
      if (CYRILLIC_PATTERN.test(line) && !line.includes(ALLOW_MARKER)) {
        entries.add(baselineKey(normalizedPath, line));
      }
    }
  }
  await writeFile(path.join(root, BASELINE_PATH), `${JSON.stringify([...entries].sort(), null, 2)}\n`, "utf8");
  console.log(`Wrote ${entries.size} reviewed legacy entries to ${BASELINE_PATH}.`);
}

async function main() {
  const root = process.cwd();
  if (process.argv.includes("--write-baseline")) {
    await writeBaseline(root);
    return;
  }
  const violations = await scanTrackedFiles(root);
  if (violations.length === 0) {
    console.log("English policy check passed.");
    return;
  }
  for (const violation of violations) {
    console.error(`${violation.filePath}:${violation.line}: ${violation.preview}`);
  }
  console.error(`English policy check failed with ${violations.length} violation(s).`);
  process.exitCode = 1;
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  await main();
}