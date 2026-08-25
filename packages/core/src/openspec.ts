// Thin wrapper over `openspec ... --json` commands (list/show/validate).
// No file-parsing magic here — `server`/`extension` must not parse
// `openspec/` by hand, only through this wrapper (see README.md core).
//
// Output shapes match the real `openspec` CLI (see the fixtures in
// `openspec-fixtures/*.json`, captured from this repository's live CLI —
// not hand-crafted, see tasks.md 5.3).

import crossSpawn from "cross-spawn";

// `cross-spawn` rather than `node:child_process.execFile`: on Windows
// `openspec` (like `copilot`, see agents/shared.ts) is installed as a
// `.cmd` shim — plain `execFile` cannot find it without `shell: true`
// (`ENOENT`), as shown by the live vscode-extension run (see tasks.md 4.1,
// openspec/changes/vscode-extension/TEST-NOTES.md). `cross-spawn` resolves
// `.cmd`/`.bat` on Windows correctly, escaping arguments individually.
function execFileAsync(
  binary: string,
  args: string[],
  options: { cwd: string; windowsHide?: boolean },
): Promise<{ stdout: string; stderr: string }> {
  return new Promise((resolve, reject) => {
    const child = crossSpawn(binary, args, options);
    let stdout = "";
    let stderr = "";
    child.stdout?.on("data", (chunk: Buffer) => {
      stdout += chunk.toString("utf8");
    });
    child.stderr?.on("data", (chunk: Buffer) => {
      stderr += chunk.toString("utf8");
    });
    child.on("error", reject);
    child.on("close", (code) => {
      if (code === 0) {
        resolve({ stdout, stderr });
      } else {
        reject(new Error(`${binary} ${args.join(" ")} exited with code ${code ?? "unknown"}: ${stderr}`));
      }
    });
  });
}

export interface OpenSpecCliOptions {
  cwd: string;
  /** The `openspec` binary; expected on PATH by default. */
  binary?: string;
}

export interface OpenSpecRoot {
  path: string;
  source: string;
}

export interface OpenSpecChangeListItem {
  name: string;
  completedTasks: number;
  totalTasks: number;
  lastModified: string;
  status: string;
}

export interface OpenSpecListResult {
  changes: OpenSpecChangeListItem[];
  root: OpenSpecRoot;
}

export interface OpenSpecSpecListItem {
  id: string;
  requirementCount: number;
}

export interface OpenSpecListSpecsResult {
  specs: OpenSpecSpecListItem[];
  root: OpenSpecRoot;
}

export interface OpenSpecScenario {
  rawText: string;
}

export interface OpenSpecRequirement {
  text: string;
  scenarios: OpenSpecScenario[];
}

export interface OpenSpecDelta {
  spec: string;
  operation: string;
  description: string;
  requirement?: OpenSpecRequirement;
  requirements?: OpenSpecRequirement[];
}

export interface OpenSpecShowResult {
  id: string;
  title: string;
  deltaCount: number;
  deltas: OpenSpecDelta[];
}

export interface OpenSpecValidationIssue {
  message: string;
  [key: string]: unknown;
}

export interface OpenSpecValidationItem {
  id: string;
  type: string;
  valid: boolean;
  issues: OpenSpecValidationIssue[];
  durationMs: number;
}

export interface OpenSpecValidateResult {
  items: OpenSpecValidationItem[];
  summary: {
    totals: { items: number; passed: number; failed: number };
    byType: Record<string, { items: number; passed: number; failed: number }>;
  };
  version: string;
  root: OpenSpecRoot;
}

export interface OpenSpecStatusArtifact {
  id: string;
  outputPath: string;
  status: string;
  requires: string[];
  missingDeps?: string[];
}

export interface OpenSpecStatusTask {
  id: string;
  description: string;
  done: boolean;
}

export interface OpenSpecStatusProgress {
  total: number;
  complete: number;
  remaining: number;
}

export interface OpenSpecStatusResult {
  changeName: string;
  schemaName: string;
  progress: OpenSpecStatusProgress;
  artifacts: OpenSpecStatusArtifact[];
  tasks?: OpenSpecStatusTask[];
  state?: string;
  instruction?: string;
  root: OpenSpecRoot;
  [key: string]: unknown;
}

interface RawOpenSpecStatusResult {
  changeName: string;
  schemaName: string;
  progress?: OpenSpecStatusProgress;
  artifacts: OpenSpecStatusArtifact[];
  tasks?: OpenSpecStatusTask[];
  state?: string;
  instruction?: string;
  root: OpenSpecRoot;
  [key: string]: unknown;
}

export interface CreateChangeOptions {
  description?: string;
  goal?: string;
}

export interface OpenSpecCreateChangeResult {
  [key: string]: unknown;
}

export interface OpenSpecInitOptions {
  tools: string[];
}

export interface OpenSpecInitResult {
  stdout: string;
  stderr: string;
}

export interface OpenSpecArchiveResult {
  [key: string]: unknown;
}

export interface ArchiveChangeOptions {
  skipSpecs?: boolean;
}

export type OpenSpecCliCompatibilityErrorCode = "invalid-json" | "incompatible-output";

export class OpenSpecCliCompatibilityError extends Error {
  constructor(
    readonly code: OpenSpecCliCompatibilityErrorCode,
    readonly command: string,
    readonly expectedContract: string,
    readonly outputPreview: string,
    options: { cause?: unknown } = {},
  ) {
    super(
      `OpenSpec CLI returned ${code === "invalid-json" ? "invalid JSON" : "incompatible JSON"} for '${command}'. `
      + `Expected ${expectedContract}. Update OpenSpec CLI or OpenSpec UI to compatible versions.`,
      { cause: options.cause },
    );
    this.name = "OpenSpecCliCompatibilityError";
  }
}

type JsonValidator<T> = (value: unknown) => value is T;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function hasString(record: Record<string, unknown>, key: string): boolean {
  return typeof record[key] === "string";
}

function hasNumber(record: Record<string, unknown>, key: string): boolean {
  return typeof record[key] === "number" && Number.isFinite(record[key]);
}

function hasBoolean(record: Record<string, unknown>, key: string): boolean {
  return typeof record[key] === "boolean";
}

function isRoot(value: unknown): value is OpenSpecRoot {
  return isRecord(value) && hasString(value, "path") && hasString(value, "source");
}

function isChangeListItem(value: unknown): value is OpenSpecChangeListItem {
  return isRecord(value)
    && hasString(value, "name")
    && hasNumber(value, "completedTasks")
    && hasNumber(value, "totalTasks")
    && hasString(value, "lastModified")
    && hasString(value, "status");
}

function isListResult(value: unknown): value is OpenSpecListResult {
  return isRecord(value)
    && Array.isArray(value.changes)
    && value.changes.every(isChangeListItem)
    && isRoot(value.root);
}

function isSpecListItem(value: unknown): value is OpenSpecSpecListItem {
  return isRecord(value) && hasString(value, "id") && hasNumber(value, "requirementCount");
}

function isListSpecsResult(value: unknown): value is OpenSpecListSpecsResult {
  return isRecord(value)
    && Array.isArray(value.specs)
    && value.specs.every(isSpecListItem)
    && isRoot(value.root);
}

function isScenario(value: unknown): value is OpenSpecScenario {
  return isRecord(value) && hasString(value, "rawText");
}

function isRequirement(value: unknown): value is OpenSpecRequirement {
  return isRecord(value)
    && hasString(value, "text")
    && Array.isArray(value.scenarios)
    && value.scenarios.every(isScenario);
}

function isDelta(value: unknown): value is OpenSpecDelta {
  if (!isRecord(value)
    || !hasString(value, "spec")
    || !hasString(value, "operation")
    || !hasString(value, "description")) return false;
  if (value.requirement !== undefined && !isRequirement(value.requirement)) return false;
  return value.requirements === undefined
    || (Array.isArray(value.requirements) && value.requirements.every(isRequirement));
}

function isShowResult(value: unknown): value is OpenSpecShowResult {
  return isRecord(value)
    && hasString(value, "id")
    && hasString(value, "title")
    && hasNumber(value, "deltaCount")
    && Array.isArray(value.deltas)
    && value.deltas.every(isDelta);
}

function isTotals(value: unknown): boolean {
  return isRecord(value) && hasNumber(value, "items") && hasNumber(value, "passed") && hasNumber(value, "failed");
}

function isValidationItem(value: unknown): value is OpenSpecValidationItem {
  return isRecord(value)
    && hasString(value, "id")
    && hasString(value, "type")
    && hasBoolean(value, "valid")
    && Array.isArray(value.issues)
    && value.issues.every((issue) => isRecord(issue) && hasString(issue, "message"))
    && hasNumber(value, "durationMs");
}

function isValidateResult(value: unknown): value is OpenSpecValidateResult {
  if (!isRecord(value)
    || !Array.isArray(value.items)
    || !value.items.every(isValidationItem)
    || !isRecord(value.summary)
    || !isTotals(value.summary.totals)
    || !isRecord(value.summary.byType)
    || !Object.values(value.summary.byType).every(isTotals)
    || !hasString(value, "version")) return false;
  return isRoot(value.root);
}

function isStatusArtifact(value: unknown): value is OpenSpecStatusArtifact {
  return isRecord(value)
    && hasString(value, "id")
    && hasString(value, "outputPath")
    && hasString(value, "status")
    && Array.isArray(value.requires)
    && value.requires.every((item) => typeof item === "string")
    && (value.missingDeps === undefined
      || (Array.isArray(value.missingDeps) && value.missingDeps.every((item) => typeof item === "string")));
}

function isStatusResult(value: unknown): value is RawOpenSpecStatusResult {
  if (!isRecord(value)
    || !hasString(value, "changeName")
    || !hasString(value, "schemaName")
    || !Array.isArray(value.artifacts)
    || !value.artifacts.every(isStatusArtifact)
    || !isRoot(value.root)) return false;
  if (value.progress !== undefined && (
    !isRecord(value.progress)
    || !hasNumber(value.progress, "total")
    || !hasNumber(value.progress, "complete")
    || !hasNumber(value.progress, "remaining")
  )) return false;
  if (value.tasks !== undefined && (!Array.isArray(value.tasks) || !value.tasks.every((task) => (
    isRecord(task) && hasString(task, "id") && hasString(task, "description") && hasBoolean(task, "done")
  )))) return false;
  return (value.state === undefined || typeof value.state === "string")
    && (value.instruction === undefined || typeof value.instruction === "string");
}

function normalizeStatusResult(value: RawOpenSpecStatusResult): OpenSpecStatusResult {
  if (value.progress) return { ...value, progress: value.progress };
  const complete = value.artifacts.filter((artifact) => artifact.status === "done").length;
  const total = value.artifacts.length;
  return {
    ...value,
    progress: { total, complete, remaining: total - complete },
  };
}

const isObjectResult = (value: unknown): value is Record<string, unknown> => isRecord(value);

function outputPreview(stdout: string): string {
  const normalized = stdout.trim().replace(/\s+/g, " ");
  return normalized.length <= 512 ? normalized : `${normalized.slice(0, 509)}...`;
}

async function runJson<T>(
  args: string[],
  options: OpenSpecCliOptions,
  expectedContract: string,
  validator: JsonValidator<T>,
): Promise<T> {
  const binary = options.binary ?? "openspec";
  const { stdout } = await execFileAsync(binary, args, { cwd: options.cwd, windowsHide: true });
  const command = args.join(" ");
  let parsed: unknown;
  try {
    parsed = JSON.parse(stdout);
  } catch (error) {
    throw new OpenSpecCliCompatibilityError(
      "invalid-json",
      command,
      expectedContract,
      outputPreview(stdout),
      { cause: error },
    );
  }
  if (!validator(parsed)) {
    throw new OpenSpecCliCompatibilityError(
      "incompatible-output",
      command,
      expectedContract,
      outputPreview(stdout),
    );
  }
  return parsed;
}

export async function listChanges(options: OpenSpecCliOptions): Promise<OpenSpecListResult> {
  return runJson(["list", "--json"], options, "changes[] and root", isListResult);
}

export async function listSpecs(options: OpenSpecCliOptions): Promise<OpenSpecListSpecsResult> {
  return runJson(["list", "--specs", "--json"], options, "specs[] and root", isListSpecsResult);
}

export async function showChange(changeName: string, options: OpenSpecCliOptions): Promise<OpenSpecShowResult> {
  return runJson(
    ["show", changeName, "--json", "--type", "change"],
    options,
    "change id, title, deltaCount, and deltas[]",
    isShowResult,
  );
}

export async function validateChange(
  changeName: string,
  options: OpenSpecCliOptions,
): Promise<OpenSpecValidateResult> {
  return runJson(
    ["validate", changeName, "--json", "--strict", "--type", "change"],
    options,
    "validation items, summary, version, and root",
    isValidateResult,
  );
}

export async function statusChange(changeName: string, options: OpenSpecCliOptions): Promise<OpenSpecStatusResult> {
  const status = await runJson(
    ["status", "--change", changeName, "--json"],
    options,
    "changeName, schemaName, artifacts[], root, and optional progress",
    isStatusResult,
  );
  return normalizeStatusResult(status);
}

export async function createChange(
  changeName: string,
  options: OpenSpecCliOptions,
  createOptions: CreateChangeOptions = {},
): Promise<OpenSpecCreateChangeResult> {
  const args = ["new", "change", changeName, "--json"];
  if (createOptions.description) {
    args.push("--description", createOptions.description);
  }
  if (createOptions.goal) {
    args.push("--goal", createOptions.goal);
  }
  return runJson(args, options, "a JSON object", isObjectResult);
}

export async function archiveChange(
  changeName: string,
  options: OpenSpecCliOptions,
  archiveOptions: ArchiveChangeOptions = {},
): Promise<OpenSpecArchiveResult> {
  const args = ["archive", changeName, "--yes", "--json"];
  if (archiveOptions.skipSpecs) args.push("--skip-specs");
  return runJson(args, options, "a JSON object", isObjectResult);
}

export async function initOpenSpec(
  options: OpenSpecCliOptions,
  initOptions: OpenSpecInitOptions,
): Promise<OpenSpecInitResult> {
  const tools = initOptions.tools.map((tool) => tool.trim()).filter((tool) => tool.length > 0);
  if (tools.length === 0) {
    throw new Error("initOpenSpec requires at least one tool");
  }
  const binary = options.binary ?? "openspec";
  const args = ["init", "--tools", tools.join(",")];
  return execFileAsync(binary, args, { cwd: options.cwd, windowsHide: true });
}
