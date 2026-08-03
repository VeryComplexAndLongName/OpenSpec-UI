// Тонкая обёртка над `openspec ... --json`-командами (list/show/validate).
// Никакой файловой магии здесь — `server`/`extension` не должны парсить
// `openspec/` руками, только через эту обёртку (см. README.md core).
//
// Формы вывода соответствуют реальному `openspec` CLI (см. фикстуры в
// `openspec-fixtures/*.json`, снятые с живого CLI этого репозитория —
// не придуманы вручную, см. tasks.md 5.3).

import crossSpawn from "cross-spawn";

// `cross-spawn`, а не `node:child_process.execFile`: на Windows `openspec`
// (как и `copilot`, см. agents/shared.ts) устанавливается как `.cmd`-шим —
// голый `execFile` не находит его без `shell: true` (`ENOENT`), что и
// показал живой прогон vscode-extension (см. tasks.md 4.1,
// openspec/changes/vscode-extension/TEST-NOTES.md). `cross-spawn` резолвит
// `.cmd`/`.bat` на Windows корректно, экранируя аргументы по отдельности.
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
  /** Бинарь `openspec`, по умолчанию ожидается в PATH. */
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

async function runJson<T>(args: string[], options: OpenSpecCliOptions): Promise<T> {
  const binary = options.binary ?? "openspec";
  const { stdout } = await execFileAsync(binary, args, { cwd: options.cwd, windowsHide: true });
  return JSON.parse(stdout) as T;
}

export async function listChanges(options: OpenSpecCliOptions): Promise<OpenSpecListResult> {
  return runJson<OpenSpecListResult>(["list", "--json"], options);
}

export async function listSpecs(options: OpenSpecCliOptions): Promise<OpenSpecListSpecsResult> {
  return runJson<OpenSpecListSpecsResult>(["list", "--specs", "--json"], options);
}

export async function showChange(changeName: string, options: OpenSpecCliOptions): Promise<OpenSpecShowResult> {
  return runJson<OpenSpecShowResult>(["show", changeName, "--json", "--type", "change"], options);
}

export async function validateChange(
  changeName: string,
  options: OpenSpecCliOptions,
): Promise<OpenSpecValidateResult> {
  return runJson<OpenSpecValidateResult>(
    ["validate", changeName, "--json", "--strict", "--type", "change"],
    options,
  );
}
