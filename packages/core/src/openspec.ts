// Тонкая обёртка над `openspec ... --json`-командами (list/show/validate).
// Никакой файловой магии здесь — `server`/`extension` не должны парсить
// `openspec/` руками, только через эту обёртку (см. README.md core).
//
// Формы вывода соответствуют реальному `openspec` CLI (см. фикстуры в
// `openspec-fixtures/*.json`, снятые с живого CLI этого репозитория —
// не придуманы вручную, см. tasks.md 5.3).

import { execFile } from "node:child_process";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);

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
