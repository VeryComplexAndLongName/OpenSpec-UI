// 1.1 REST endpoint for `status` — a synchronous response with the full
// list of events from this run. `status` is a regular `execution-core`
// command (see `@openspec-ui/core`'s agents/shared.ts commandInstruction),
// just fast enough that it does not need WS for its own sake (see
// openspec/changes/standalone-app/design.md, "Decisions").

import type { IncomingMessage, ServerResponse } from "node:http";
import { access } from "node:fs/promises";
import path from "node:path";
import {
  ArchivedChangeNotFoundError,
  ChangeEditorConflictError,
  TemplateAlreadyExistsError,
  UnknownBuiltInTemplateError,
  UnknownProjectTemplateError,
  createChange,
  customizeTemplate,
  deleteProjectTemplate,
  detectAvailableAgents,
  discoverOpenSpecWorkspace,
  findBuiltInTemplate,
  getChangeTimeline,
  getChangeTimelines,
  initOpenSpec,
  listBuiltInTemplates,
  listChanges,
  listProjectTemplates,
  listSpecs,
  readArchivedChangeTasksTemplate,
  readChangeEditorDocument,
  renderTemplate,
  saveChangeEditorDocument,
  showChange,
  statusChange,
  validateChange,
  type AgentRunner,
  type CatalogTemplate,
  type ChangeTimelineRequestEntry,
  type Command,
  type Event,
  type OpenSpecChangeListItem,
  type OpenSpecRoot,
  type OpenSpecSpecListItem,
  resolveRunner,
} from "@openspec-ui/core";
import { isCommandLike } from "./wire.js";

export interface RestRequestPolicy {
  maxPayloadBytes: number;
  isCwdAllowed(cwd: string): boolean;
}

class PayloadTooLargeError extends Error {}

async function readJsonBody(req: IncomingMessage, maxPayloadBytes: number): Promise<unknown> {
  const chunks: Buffer[] = [];
  let totalBytes = 0;
  for await (const chunk of req) {
    const buffer = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk as Uint8Array);
    totalBytes += buffer.byteLength;
    if (totalBytes > maxPayloadBytes) throw new PayloadTooLargeError();
    chunks.push(buffer);
  }
  return JSON.parse(Buffer.concat(chunks).toString("utf8"));
}

function sendJson(res: ServerResponse, statusCode: number, body: unknown): void {
  res.writeHead(statusCode, { "content-type": "application/json" });
  res.end(JSON.stringify(body));
}

function sendBodyError(res: ServerResponse, error: unknown): void {
  if (error instanceof PayloadTooLargeError) {
    sendJson(res, 413, { error: "request payload is too large" });
  } else {
    sendJson(res, 400, { error: "invalid JSON body" });
  }
}

function authorizeCwd(res: ServerResponse, policy: RestRequestPolicy, cwd: string): boolean {
  if (policy.isCwdAllowed(cwd)) return true;
  sendJson(res, 403, { error: "cwd is outside the configured workspace" });
  return false;
}

interface OverviewRequest {
  cwd: string;
}

interface OverviewResponse {
  root: OpenSpecRoot;
  changes: OpenSpecChangeListItem[];
  specs: OpenSpecSpecListItem[];
  /** Names of archived changes — source list for "copy tasks as template"
   * (see openspec/changes/archive-tasks-as-template/design.md). Populated
   * via `discoverOpenSpecWorkspace`, independent of `listChanges` (the
   * `openspec list` CLI wrapper), which never returns archived changes. */
  archivedChanges: string[];
  initialization: OpenSpecInitialization;
}

interface OpenSpecInitialization {
  hasOpenSpecDir: boolean;
  hasInitializationArtifacts: boolean;
  canInitialize: boolean;
}

function isOverviewRequest(value: unknown): value is OverviewRequest {
  if (typeof value !== "object" || value === null) return false;
  const record = value as Record<string, unknown>;
  return typeof record.cwd === "string" && record.cwd.trim().length > 0;
}

function nowIso(): string {
  return new Date().toISOString();
}

interface ChangeEditorReadRequest {
  cwd: string;
  changeName: string;
}

interface ChangeTimelineRequest {
  cwd: string;
  changeName: string;
  archived: boolean;
}

interface ChangeTimelinesRequest {
  cwd: string;
  entries: ChangeTimelineRequestEntry[];
}

function isChangeTimelineRequest(value: unknown): value is ChangeTimelineRequest {
  if (!isObjectRecord(value)) return false;
  return (
    isNonEmptyString(value.cwd) && isChangeName(value.changeName) && typeof value.archived === "boolean"
  );
}

function isChangeTimelineRequestEntry(value: unknown): value is ChangeTimelineRequestEntry {
  if (!isObjectRecord(value)) return false;
  return isChangeName(value.changeName) && typeof value.archived === "boolean";
}

function isChangeTimelinesRequest(value: unknown): value is ChangeTimelinesRequest {
  if (!isObjectRecord(value)) return false;
  if (!isNonEmptyString(value.cwd) || !Array.isArray(value.entries)) return false;
  return value.entries.every(isChangeTimelineRequestEntry);
}

interface ChangeEditorSaveRequest extends ChangeEditorReadRequest {
  revision: string;
  files: {
    proposal: string;
    design: string;
    tasks: string;
    spec: string;
  };
}

interface ChangeEditorCreateRequest {
  cwd: string;
  changeName: string;
  description?: string;
}

interface OpenSpecInitRequest {
  cwd: string;
  tools: string[];
}

const SUPPORTED_INIT_TOOLS = new Set([
  "amazon-q",
  "antigravity",
  "auggie",
  "bob",
  "claude",
  "cline",
  "codeartsagent",
  "codex",
  "devin",
  "forgecode",
  "codebuddy",
  "continue",
  "costrict",
  "crush",
  "cursor",
  "factory",
  "gemini",
  "github-copilot",
  "hermes",
  "iflow",
  "junie",
  "kilocode",
  "kimi",
  "kiro",
  "lingma",
  "vibe",
  "oh-my-pi",
  "opencode",
  "pi",
  "qoder",
  "qwen",
  "roocode",
  "trae",
  "zcode",
]);

function isNonEmptyString(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0;
}

function isChangeName(value: unknown): value is string {
  return typeof value === "string" && /^[a-z0-9][a-z0-9-]*$/i.test(value);
}

function isChangeEditorReadRequest(value: unknown): value is ChangeEditorReadRequest {
  if (!isObjectRecord(value)) return false;
  return isNonEmptyString(value.cwd) && isChangeName(value.changeName);
}

// Same shape as `ChangeEditorReadRequest` (cwd + changeName), reused as a
// distinct name/validator so the archive-template endpoint documents its
// own contract independently — see
// openspec/changes/archive-tasks-as-template/design.md.
type ArchiveTasksTemplateRequest = ChangeEditorReadRequest;

function isArchiveTasksTemplateRequest(value: unknown): value is ArchiveTasksTemplateRequest {
  return isChangeEditorReadRequest(value);
}

function isTemplateId(value: unknown): value is string {
  // Matches core's `TEMPLATE_ID_PATTERN` exactly (template-catalog.ts) —
  // lowercase-only, unlike `isChangeName`'s case-insensitive match.
  return typeof value === "string" && /^[a-z0-9][a-z0-9-]*$/.test(value);
}

interface TemplatesCustomizeRequest {
  cwd: string;
  id: string;
}

function isTemplatesCustomizeRequest(value: unknown): value is TemplatesCustomizeRequest {
  if (!isObjectRecord(value)) return false;
  return isNonEmptyString(value.cwd) && isTemplateId(value.id);
}

interface TemplatesRenderRequest {
  cwd: string;
  origin: "built-in" | "project";
  id: string;
  variables: Record<string, string | boolean>;
}

function isTemplatesRenderRequest(value: unknown): value is TemplatesRenderRequest {
  if (!isObjectRecord(value)) return false;
  if (!isNonEmptyString(value.cwd)) return false;
  if (value.origin !== "built-in" && value.origin !== "project") return false;
  if (!isTemplateId(value.id)) return false;
  if (!isObjectRecord(value.variables)) return false;
  return Object.values(value.variables).every((v) => typeof v === "string" || typeof v === "boolean");
}

function isChangeEditorCreateRequest(value: unknown): value is ChangeEditorCreateRequest {
  if (!isObjectRecord(value)) return false;
  if (!isNonEmptyString(value.cwd) || !isChangeName(value.changeName)) return false;
  return value.description === undefined || typeof value.description === "string";
}

function isChangeEditorSaveRequest(value: unknown): value is ChangeEditorSaveRequest {
  if (!isObjectRecord(value)) return false;
  if (!isNonEmptyString(value.cwd) || !isChangeName(value.changeName)) return false;
  if (!isNonEmptyString(value.revision)) return false;
  if (!isObjectRecord(value.files)) return false;
  const files = value.files;
  return (
    typeof files.proposal === "string" &&
    typeof files.design === "string" &&
    typeof files.tasks === "string" &&
    typeof files.spec === "string"
  );
}

function isObjectRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function normalizeRequestedTools(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  const normalized = value
    .filter((item): item is string => typeof item === "string")
    .map((item) => item.trim())
    .filter((item) => item.length > 0);
  return [...new Set(normalized)];
}

function isOpenSpecInitRequest(value: unknown): value is OpenSpecInitRequest {
  if (!isObjectRecord(value)) return false;
  if (!isNonEmptyString(value.cwd)) return false;
  const tools = normalizeRequestedTools(value.tools);
  if (tools.length === 0) return false;
  return tools.every((tool) => SUPPORTED_INIT_TOOLS.has(tool));
}

async function pathExists(targetPath: string): Promise<boolean> {
  try {
    await access(targetPath);
    return true;
  } catch {
    return false;
  }
}

async function detectOpenSpecInitialization(cwd: string): Promise<OpenSpecInitialization> {
  const openspecDir = path.resolve(cwd, "openspec");
  const [hasOpenSpecDir, hasConfigYaml, hasChangesDir, hasSpecsDir] = await Promise.all([
    pathExists(openspecDir),
    pathExists(path.join(openspecDir, "config.yaml")),
    pathExists(path.join(openspecDir, "changes")),
    pathExists(path.join(openspecDir, "specs")),
  ]);

  const hasInitializationArtifacts = hasConfigYaml || hasChangesDir || hasSpecsDir;
  return {
    hasOpenSpecDir,
    hasInitializationArtifacts,
    canInitialize: !hasInitializationArtifacts,
  };
}

export async function handleChangeEditorCreateRequest(req: IncomingMessage, res: ServerResponse, policy: RestRequestPolicy): Promise<void> {
  let parsed: unknown;
  try {
    parsed = await readJsonBody(req, policy.maxPayloadBytes);
  } catch (error) {
    sendBodyError(res, error);
    return;
  }

  if (!isChangeEditorCreateRequest(parsed)) {
    sendJson(res, 400, { error: "body must contain cwd and valid changeName" });
    return;
  }
  if (!authorizeCwd(res, policy, parsed.cwd)) return;

  try {
    await createChange(parsed.changeName, { cwd: parsed.cwd }, { description: parsed.description });
    sendJson(res, 200, { ok: true, changeName: parsed.changeName });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    sendJson(res, 500, { error: `failed to create change: ${message}` });
  }
}

export async function handleChangeEditorReadRequest(req: IncomingMessage, res: ServerResponse, policy: RestRequestPolicy): Promise<void> {
  let parsed: unknown;
  try {
    parsed = await readJsonBody(req, policy.maxPayloadBytes);
  } catch (error) {
    sendBodyError(res, error);
    return;
  }

  if (!isChangeEditorReadRequest(parsed)) {
    sendJson(res, 400, { error: "body must contain cwd and valid changeName" });
    return;
  }
  if (!authorizeCwd(res, policy, parsed.cwd)) return;

  try {
    sendJson(res, 200, await readChangeEditorDocument(parsed.cwd, parsed.changeName));
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    sendJson(res, 500, { error: `failed to read change files: ${message}` });
  }
}

export async function handleChangeTimelineRequest(req: IncomingMessage, res: ServerResponse, policy: RestRequestPolicy): Promise<void> {
  let parsed: unknown;
  try {
    parsed = await readJsonBody(req, policy.maxPayloadBytes);
  } catch (error) {
    sendBodyError(res, error);
    return;
  }

  if (!isChangeTimelineRequest(parsed)) {
    sendJson(res, 400, { error: "body must contain cwd, valid changeName, and archived" });
    return;
  }
  if (!authorizeCwd(res, policy, parsed.cwd)) return;

  try {
    sendJson(res, 200, await getChangeTimeline(parsed.cwd, parsed.changeName, parsed.archived));
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    sendJson(res, 500, { error: `failed to read change timeline: ${message}` });
  }
}

export async function handleChangeTimelinesRequest(req: IncomingMessage, res: ServerResponse, policy: RestRequestPolicy): Promise<void> {
  let parsed: unknown;
  try {
    parsed = await readJsonBody(req, policy.maxPayloadBytes);
  } catch (error) {
    sendBodyError(res, error);
    return;
  }

  if (!isChangeTimelinesRequest(parsed)) {
    sendJson(res, 400, { error: "body must contain cwd and a valid entries array" });
    return;
  }
  if (!authorizeCwd(res, policy, parsed.cwd)) return;

  try {
    sendJson(res, 200, await getChangeTimelines(parsed.cwd, parsed.entries));
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    sendJson(res, 500, { error: `failed to read change timelines: ${message}` });
  }
}

export async function handleArchiveTasksTemplateRequest(req: IncomingMessage, res: ServerResponse, policy: RestRequestPolicy): Promise<void> {
  let parsed: unknown;
  try {
    parsed = await readJsonBody(req, policy.maxPayloadBytes);
  } catch (error) {
    sendBodyError(res, error);
    return;
  }

  if (!isArchiveTasksTemplateRequest(parsed)) {
    sendJson(res, 400, { error: "body must contain cwd and valid changeName" });
    return;
  }
  if (!authorizeCwd(res, policy, parsed.cwd)) return;

  try {
    const template = await readArchivedChangeTasksTemplate(parsed.cwd, parsed.changeName);
    sendJson(res, 200, { template });
  } catch (error) {
    if (error instanceof ArchivedChangeNotFoundError) {
      sendJson(res, 404, { error: error.message });
      return;
    }
    const message = error instanceof Error ? error.message : String(error);
    sendJson(res, 500, { error: `failed to read archived tasks template: ${message}` });
  }
}

export async function handleTemplatesListRequest(req: IncomingMessage, res: ServerResponse, policy: RestRequestPolicy): Promise<void> {
  let parsed: unknown;
  try {
    parsed = await readJsonBody(req, policy.maxPayloadBytes);
  } catch (error) {
    sendBodyError(res, error);
    return;
  }

  if (!isOverviewRequest(parsed)) {
    sendJson(res, 400, { error: "body must contain a non-empty cwd" });
    return;
  }
  if (!authorizeCwd(res, policy, parsed.cwd)) return;

  try {
    const [builtIn, project] = await Promise.all([
      Promise.resolve(listBuiltInTemplates()),
      listProjectTemplates(parsed.cwd),
    ]);
    sendJson(res, 200, { builtIn, project });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    sendJson(res, 500, { error: `failed to list templates: ${message}` });
  }
}

export async function handleTemplatesCustomizeRequest(req: IncomingMessage, res: ServerResponse, policy: RestRequestPolicy): Promise<void> {
  let parsed: unknown;
  try {
    parsed = await readJsonBody(req, policy.maxPayloadBytes);
  } catch (error) {
    sendBodyError(res, error);
    return;
  }

  if (!isTemplatesCustomizeRequest(parsed)) {
    sendJson(res, 400, { error: "body must contain cwd and a valid template id" });
    return;
  }
  if (!authorizeCwd(res, policy, parsed.cwd)) return;

  try {
    const template = await customizeTemplate(parsed.cwd, parsed.id);
    sendJson(res, 200, template);
  } catch (error) {
    if (error instanceof TemplateAlreadyExistsError) {
      sendJson(res, 409, { error: error.message });
      return;
    }
    if (error instanceof UnknownBuiltInTemplateError) {
      sendJson(res, 404, { error: error.message });
      return;
    }
    const message = error instanceof Error ? error.message : String(error);
    sendJson(res, 500, { error: `failed to customize template: ${message}` });
  }
}

export async function handleTemplatesDeleteRequest(req: IncomingMessage, res: ServerResponse, policy: RestRequestPolicy): Promise<void> {
  let parsed: unknown;
  try {
    parsed = await readJsonBody(req, policy.maxPayloadBytes);
  } catch (error) {
    sendBodyError(res, error);
    return;
  }

  if (!isTemplatesCustomizeRequest(parsed)) {
    sendJson(res, 400, { error: "body must contain cwd and a valid template id" });
    return;
  }
  if (!authorizeCwd(res, policy, parsed.cwd)) return;

  try {
    await deleteProjectTemplate(parsed.cwd, parsed.id);
    sendJson(res, 200, { ok: true });
  } catch (error) {
    if (error instanceof UnknownProjectTemplateError) {
      sendJson(res, 404, { error: error.message });
      return;
    }
    const message = error instanceof Error ? error.message : String(error);
    sendJson(res, 500, { error: `failed to delete template: ${message}` });
  }
}

export async function handleTemplatesRenderRequest(req: IncomingMessage, res: ServerResponse, policy: RestRequestPolicy): Promise<void> {
  let parsed: unknown;
  try {
    parsed = await readJsonBody(req, policy.maxPayloadBytes);
  } catch (error) {
    sendBodyError(res, error);
    return;
  }

  if (!isTemplatesRenderRequest(parsed)) {
    sendJson(res, 400, { error: "body must contain cwd, origin, id, and variables" });
    return;
  }
  if (!authorizeCwd(res, policy, parsed.cwd)) return;

  try {
    let template: CatalogTemplate | undefined;
    if (parsed.origin === "built-in") {
      template = findBuiltInTemplate(parsed.id);
    } else {
      template = (await listProjectTemplates(parsed.cwd)).find((t) => t.manifest.id === parsed.id);
    }
    if (!template) {
      sendJson(res, 404, { error: `Template not found: ${parsed.origin}/${parsed.id}` });
      return;
    }
    sendJson(res, 200, renderTemplate(template, parsed.variables));
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    sendJson(res, 500, { error: `failed to render template: ${message}` });
  }
}

export async function handleAgentsDetectRequest(
  req: IncomingMessage,
  res: ServerResponse,
  policy: RestRequestPolicy,
  localLlmBaseUrl?: string,
): Promise<void> {
  let parsed: unknown;
  try {
    parsed = await readJsonBody(req, policy.maxPayloadBytes);
  } catch (error) {
    sendBodyError(res, error);
    return;
  }

  if (!isOverviewRequest(parsed)) {
    sendJson(res, 400, { error: "body must contain a non-empty cwd" });
    return;
  }
  if (!authorizeCwd(res, policy, parsed.cwd)) return;

  try {
    const agents = await detectAvailableAgents({ localLlmBaseUrl });
    sendJson(res, 200, { agents });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    sendJson(res, 500, { error: `failed to detect agents: ${message}` });
  }
}

export async function handleChangeEditorSaveRequest(req: IncomingMessage, res: ServerResponse, policy: RestRequestPolicy): Promise<void> {
  let parsed: unknown;
  try {
    parsed = await readJsonBody(req, policy.maxPayloadBytes);
  } catch (error) {
    sendBodyError(res, error);
    return;
  }

  if (!isChangeEditorSaveRequest(parsed)) {
    sendJson(res, 400, { error: "body must contain cwd/changeName/files" });
    return;
  }
  if (!authorizeCwd(res, policy, parsed.cwd)) return;

  try {
    const saved = await saveChangeEditorDocument(
      parsed.cwd,
      parsed.changeName,
      parsed.files,
      parsed.revision,
    );
    sendJson(res, 200, { ok: true, ...saved });
  } catch (error) {
    if (error instanceof ChangeEditorConflictError) {
      sendJson(res, 409, { error: error.message });
      return;
    }
    const message = error instanceof Error ? error.message : String(error);
    sendJson(res, 500, { error: `failed to save change files: ${message}` });
  }
}

export async function handleOpenSpecInitRequest(req: IncomingMessage, res: ServerResponse, policy: RestRequestPolicy): Promise<void> {
  let parsed: unknown;
  try {
    parsed = await readJsonBody(req, policy.maxPayloadBytes);
  } catch (error) {
    sendBodyError(res, error);
    return;
  }

  if (!isOpenSpecInitRequest(parsed)) {
    sendJson(res, 400, { error: "body must contain cwd and supported tools[]" });
    return;
  }
  if (!authorizeCwd(res, policy, parsed.cwd)) return;

  try {
    const initialization = await detectOpenSpecInitialization(parsed.cwd);
    if (!initialization.canInitialize) {
      sendJson(res, 409, { error: "OpenSpec initialization artifacts already exist in this workspace" });
      return;
    }

    await initOpenSpec({ cwd: parsed.cwd }, { tools: normalizeRequestedTools(parsed.tools) });
    const nextInitialization = await detectOpenSpecInitialization(parsed.cwd);
    sendJson(res, 200, { ok: true, initialization: nextInitialization });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    sendJson(res, 500, { error: `failed to initialize OpenSpec: ${message}` });
  }
}

export async function handleStatusRequest(
  req: IncomingMessage,
  res: ServerResponse,
  runners: Map<string, AgentRunner>,
  policy: RestRequestPolicy,
): Promise<void> {
  let parsed: unknown;
  try {
    parsed = await readJsonBody(req, policy.maxPayloadBytes);
  } catch (error) {
    sendBodyError(res, error);
    return;
  }

  if (!isCommandLike(parsed)) {
    sendJson(res, 400, { error: "body does not match the Command shape" });
    return;
  }
  const command = parsed as Command;
  if (!authorizeCwd(res, policy, command.cwd)) return;

  const runner = resolveRunner(runners, command.agentId);
  if (!runner) {
    sendJson(res, 400, { error: `unknown agentId: ${String(command.agentId)}` });
    return;
  }

  const events: Event[] = [];
  for await (const event of runner.run(command)) {
    events.push(event);
  }
  sendJson(res, 200, { events });
}

export async function handleOverviewRequest(req: IncomingMessage, res: ServerResponse, policy: RestRequestPolicy): Promise<void> {
  let parsed: unknown;
  try {
    parsed = await readJsonBody(req, policy.maxPayloadBytes);
  } catch (error) {
    sendBodyError(res, error);
    return;
  }

  if (!isOverviewRequest(parsed)) {
    sendJson(res, 400, { error: "body must contain a non-empty cwd" });
    return;
  }

  const cwd = parsed.cwd;
  if (!authorizeCwd(res, policy, cwd)) return;

  try {
    const initialization = await detectOpenSpecInitialization(cwd);
    if (!initialization.hasInitializationArtifacts) {
      const payload: OverviewResponse = {
        root: { path: cwd, source: initialization.hasOpenSpecDir ? "openspec-dir" : "cwd" },
        changes: [],
        specs: [],
        archivedChanges: [],
        initialization,
      };
      sendJson(res, 200, payload);
      return;
    }

    const [changesResult, specsResult, workspace] = await Promise.all([
      listChanges({ cwd }),
      listSpecs({ cwd }),
      discoverOpenSpecWorkspace(cwd),
    ]);

    const payload: OverviewResponse = {
      root: changesResult.root,
      changes: changesResult.changes,
      specs: specsResult.specs,
      archivedChanges: workspace.archivedChanges.map((change) => change.name),
      initialization,
    };
    sendJson(res, 200, payload);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    sendJson(res, 500, { error: `failed to load OpenSpec overview: ${message}` });
  }
}

export async function handleStatusJsonRequest(req: IncomingMessage, res: ServerResponse, policy: RestRequestPolicy): Promise<void> {
  let parsed: unknown;
  try {
    parsed = await readJsonBody(req, policy.maxPayloadBytes);
  } catch (error) {
    sendBodyError(res, error);
    return;
  }

  if (!isCommandLike(parsed)) {
    sendJson(res, 400, { error: "body does not match the Command shape" });
    return;
  }

  const command = parsed as Command;
  if (!authorizeCwd(res, policy, command.cwd)) return;
  const events: Event[] = [
    {
      kind: "started",
      runId: command.runId,
      timestamp: nowIso(),
      command: command.kind,
      cwd: command.cwd,
    },
  ];

  try {
    const changeName = path.basename(command.context.changeDir);
    let result: unknown;
    let summary = "completed";

    switch (command.kind) {
      case "status": {
        if (!changeName) {
          throw new Error("failed to resolve change name from changeDir");
        }
        const status = await statusChange(changeName, { cwd: command.cwd });
        result = status;
        const progress = status.progress;
        if (progress && typeof progress.complete === "number" && typeof progress.total === "number") {
          summary = `${progress.complete}/${progress.total} tasks complete`;
        } else {
          summary = `status loaded for ${status.changeName}`;
        }
        break;
      }
      case "list": {
        const listed = await listChanges({ cwd: command.cwd });
        result = listed;
        summary = `${listed.changes.length} changes listed`;
        break;
      }
      case "show": {
        if (!changeName) {
          throw new Error("failed to resolve change name from changeDir");
        }
        const shown = await showChange(changeName, { cwd: command.cwd });
        result = shown;
        summary = `${shown.deltaCount} deltas in ${shown.id}`;
        break;
      }
      case "validate": {
        if (!changeName) {
          throw new Error("failed to resolve change name from changeDir");
        }
        const validation = await validateChange(changeName, { cwd: command.cwd });
        result = validation;
        summary = `${validation.summary.totals.passed}/${validation.summary.totals.items} passed`;
        break;
      }
      default:
        throw new Error(`unsupported direct OpenSpec command: ${command.kind}`);
    }

    events.push({
      kind: "stdout",
      runId: command.runId,
      timestamp: nowIso(),
      chunk: JSON.stringify(result),
    });
    events.push({
      kind: "completed",
      runId: command.runId,
      timestamp: nowIso(),
      summary,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    events.push({
      kind: "failed",
      runId: command.runId,
      timestamp: nowIso(),
      reason: message,
    });
  }

  sendJson(res, 200, { events });
}
