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
): Promise<{ stdout: string; stderr: string; code: number | null }> {
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
    // Resolves whatever happened, including a non-zero exit: some
    // subcommands use one to report a finding and print the finding on
    // stdout, so "the process failed" is a decision for the caller (see
    // `runJson`'s `acceptNonZeroExit`), not something to make here where
    // the output has not been looked at yet.
    child.on("close", (code) => resolve({ stdout, stderr, code }));
  });
}

/** Lines a Node runtime prints on its own behalf, which say nothing about
 * the command that was run. Stripped before deciding whether a stream
 * carries a diagnosis: the defect this exists for reported
 * `ExperimentalWarning: Importing JSON modules is an experimental
 * feature` as the entire reason a change was rejected, while the actual
 * diagnosis sat unread on stdout. */
const RUNTIME_NOISE_RE = /^\s*(?:\(node:\d+\)\s*)?(?:\[[A-Z_]+\]\s*)?(?:Experimental|Deprecation|Warning:|\(Use `node)/;

function withoutRuntimeNoise(stream: string): string {
  return stream
    .split(/\r?\n/)
    .filter((line) => line.trim().length > 0 && !RUNTIME_NOISE_RE.test(line))
    .join("\n")
    .trim();
}

/** What the tool actually said, preferring stdout — the stream a
 * `--json` subcommand reports on — and falling back to stderr. Returns
 * `undefined` when neither carries anything but runtime noise, so a
 * caller can say so rather than passing the noise off as an explanation.
 */
function diagnosisFrom(stdout: string, stderr: string): string | undefined {
  const fromStdout = withoutRuntimeNoise(stdout);
  if (fromStdout.length > 0) return fromStdout;
  const fromStderr = withoutRuntimeNoise(stderr);
  return fromStderr.length > 0 ? fromStderr : undefined;
}

function failureMessage(
  binary: string,
  args: string[],
  code: number | null,
  stdout: string,
  stderr: string,
): string {
  const reason = diagnosisFrom(stdout, stderr) ?? "no diagnosis reported";
  return `${binary} ${args.join(" ")} exited with code ${code ?? "unknown"}: ${reason}`;
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
  /** Task progress, exactly as the CLI reported it — absent when it
   * reported none. Never derived from `artifacts`: an artifact's `"done"`
   * means that file exists, which is not a statement about whether the
   * change's tasks are done. Conflating the two once let chains archive
   * two changes whose every task was still unchecked (see
   * openspec/changes/harness-chain-archive-gate). A caller that needs task
   * completion must read the task list, not this field's absence. */
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

function isStatusResult(value: unknown): value is OpenSpecStatusResult {
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
  /** Set where a non-zero exit is how the subcommand reports a finding
   * rather than a failure — `validate` exits 1 for an invalid change and
   * prints the full report on stdout. The report is then the answer, and
   * the exit code adds nothing it does not already say. Left unset
   * everywhere else: for `list`/`show`/`status`/`archive` a non-zero exit
   * is a failure, and treating stdout as authoritative there would need
   * its own reasoning about what a partial run may claim. */
  opts: { acceptNonZeroExit?: boolean } = {},
): Promise<T> {
  const binary = options.binary ?? "openspec";
  const { stdout, stderr, code } = await execFileAsync(binary, args, { cwd: options.cwd, windowsHide: true });
  const command = args.join(" ");
  const failed = code !== 0;
  if (failed && !opts.acceptNonZeroExit) {
    throw new Error(failureMessage(binary, args, code, stdout, stderr));
  }
  let parsed: unknown;
  try {
    parsed = JSON.parse(stdout);
  } catch (error) {
    // A non-zero exit with nothing readable on stdout is the case the
    // exit code was the only signal for all along — report it as the
    // failure it is, not as a compatibility problem with the contract.
    if (failed) throw new Error(failureMessage(binary, args, code, stdout, stderr));
    throw new OpenSpecCliCompatibilityError(
      "invalid-json",
      command,
      expectedContract,
      outputPreview(stdout),
      { cause: error },
    );
  }
  if (!validator(parsed)) {
    if (failed) throw new Error(failureMessage(binary, args, code, stdout, stderr));
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
  // `validate` exits 1 to say a change is invalid, with the report on
  // stdout. Reading the exit code alone reported every invalid change as
  // one that could not be validated, and threw away the diagnosis that
  // named the fix — see openspec/changes/validate-failure-says-why.
  return runJson(
    ["validate", changeName, "--json", "--strict", "--type", "change"],
    options,
    "validation items, summary, version, and root",
    isValidateResult,
    { acceptNonZeroExit: true },
  );
}

export async function statusChange(changeName: string, options: OpenSpecCliOptions): Promise<OpenSpecStatusResult> {
  return runJson(
    ["status", "--change", changeName, "--json"],
    options,
    "changeName, schemaName, artifacts[], root, and optional progress",
    isStatusResult,
  );
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
  // `archive` refuses by printing a report and exiting non-zero — the
  // report is the answer, exactly as it is for `validate`. Accepted here
  // so the refusal can be read; unlike `validate`, it is then turned back
  // into a throw, because every caller of this function asks whether it
  // worked and why not, rather than for a result to render.
  const result = await runJson(args, options, "a JSON object", isObjectResult, { acceptNonZeroExit: true });
  const refusal = describeArchiveRefusal(result);
  if (refusal) throw new Error(`could not archive "${changeName}": ${refusal}`);
  return result;
}

interface ArchiveStatusEntry {
  severity?: unknown;
  code?: unknown;
  message?: unknown;
  /** What the tool says to do about it — observed on a real refusal as
   * "Fix the change delta specs and rerun. No files were changed."
   * Carried through because a reason plus a remedy is what stops the
   * reader running the command again to see whether anything moved. */
  fix?: unknown;
}

/** The reasons an archive was refused, or `undefined` when it was not.
 *
 * Reads `status[]` rather than `archive === null`: that field says only
 * that nothing was archived and never why, so a caller reading it would
 * still have to find the reason somewhere else. Every error is reported
 * rather than the first — a change can be refused for two reasons at
 * once, and reporting one sends the reader round the loop for the other. */
function describeArchiveRefusal(result: OpenSpecArchiveResult): string | undefined {
  const archived = (result as { archive?: unknown }).archive;
  const status = (result as { status?: unknown }).status;
  if (!Array.isArray(status)) {
    return archived === null ? "the archive did not happen, and no reason was given" : undefined;
  }
  const messages = (status as ArchiveStatusEntry[])
    .filter((entry) => entry.severity === "error")
    .map((entry) => {
      const reason = typeof entry.message === "string" && entry.message.trim().length > 0
        ? entry.message.trim()
        : typeof entry.code === "string" ? entry.code : undefined;
      if (reason === undefined) return undefined;
      const fix = typeof entry.fix === "string" && entry.fix.trim().length > 0 ? entry.fix.trim() : undefined;
      return fix ? `${reason} ${fix}` : reason;
    })
    .filter((message): message is string => message !== undefined);
  if (messages.length > 0) return messages.join("; ");
  return archived === null ? "the archive did not happen, and the report gave no reason" : undefined;
}

/** Returns the project's own instructions for `artifact` (e.g. `"tasks"`),
 * as `openspec instructions <artifact> --change <changeName>` prints them —
 * raw text, since this subcommand has no `--json` form. Returns `undefined`
 * rather than throwing when the subcommand fails or prints nothing, so a
 * caller can treat the rules as best-effort (see security.ts
 * prepareAgentContext, design.md "A failed lookup degrades to today's
 * behavior"). */
export async function instructionsForArtifact(
  artifact: string,
  changeName: string,
  options: OpenSpecCliOptions,
): Promise<string | undefined> {
  const binary = options.binary ?? "openspec";
  try {
    const { stdout } = await execFileAsync(
      binary,
      ["instructions", artifact, "--change", changeName],
      { cwd: options.cwd, windowsHide: true },
    );
    return stdout.trim().length > 0 ? stdout : undefined;
  } catch {
    return undefined;
  }
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
