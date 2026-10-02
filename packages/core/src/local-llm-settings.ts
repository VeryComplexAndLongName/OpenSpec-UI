// Where the local LLM is, which model it serves, and the key it wants
// (the-local-llm-is-where-you-say).
//
// None of it is in `agent-harness.json`: that file is committed, a LAN
// address is one machine's, and a key committed is a key published. A host
// passes what it was told - the editor from its settings and its secret
// storage - and what it was not told comes from the process environment,
// which is how the standalone server and the CLI are told anything. Nothing
// here writes the key anywhere: it reaches the request's Authorization
// header and nothing else.

/** Where the adapter looked before any of this could be set. */
export const LOCAL_LLM_DEFAULT_BASE_URL = "http://localhost:30000";
export const LOCAL_LLM_DEFAULT_MODEL = "default";

/** The environment variables a host that has no settings of its own reads. */
export const LOCAL_LLM_ENVIRONMENT = {
  baseUrl: "OPENSPEC_UI_LOCAL_LLM_BASE_URL",
  model: "OPENSPEC_UI_LOCAL_LLM_MODEL",
  apiKey: "OPENSPEC_UI_LOCAL_LLM_API_KEY",
} as const;

/** Process settings for the ACP-flavored local coding agent. */
export const LOCAL_LLM_ACP_ENVIRONMENT = {
  maxIterations: "OPENSPEC_UI_LOCAL_LLM_ACP_MAX_ITERATIONS",
  maxToolCalls: "OPENSPEC_UI_LOCAL_LLM_ACP_MAX_TOOL_CALLS",
  maxSeconds: "OPENSPEC_UI_LOCAL_LLM_ACP_MAX_SECONDS",
  commandTimeoutSeconds: "OPENSPEC_UI_LOCAL_LLM_ACP_COMMAND_TIMEOUT_SECONDS",
  maxCommandOutputChars: "OPENSPEC_UI_LOCAL_LLM_ACP_MAX_COMMAND_OUTPUT_CHARS",
  maxPromptTokens: "OPENSPEC_UI_LOCAL_LLM_ACP_MAX_PROMPT_TOKENS",
  maxCompletionTokens: "OPENSPEC_UI_LOCAL_LLM_ACP_MAX_COMPLETION_TOKENS",
  maxTotalTokens: "OPENSPEC_UI_LOCAL_LLM_ACP_MAX_TOTAL_TOKENS",
  maxContextUsedTokens: "OPENSPEC_UI_LOCAL_LLM_ACP_MAX_CONTEXT_USED_TOKENS",
  maxContextWindowTokens: "OPENSPEC_UI_LOCAL_LLM_ACP_MAX_CONTEXT_WINDOW_TOKENS",
  maxContextShare: "OPENSPEC_UI_LOCAL_LLM_ACP_MAX_CONTEXT_SHARE",
  minFreeContextTokens: "OPENSPEC_UI_LOCAL_LLM_ACP_MIN_FREE_CONTEXT_TOKENS",
} as const;

export interface LocalLlmSettings {
  baseUrl: string;
  /** Where a host or the environment named one. Absent otherwise: the run
   * then asks the server (`resolveLocalLlmModel`). */
  model?: string;
  /** Sent as a bearer token where set; a server that wants none gets none. */
  apiKey?: string;
}

export interface LocalLlmAcpLimits {
  maxIterations?: number;
  maxToolCalls?: number;
  maxSeconds?: number;
  commandTimeoutSeconds?: number;
  maxCommandOutputChars?: number;
  maxPromptTokens?: number;
  maxCompletionTokens?: number;
  maxTotalTokens?: number;
  maxContextUsedTokens?: number;
  maxContextWindowTokens?: number;
  maxContextShare?: number;
  minFreeContextTokens?: number;
}

export interface LocalLlmAcpSettings extends LocalLlmSettings {
  limits: LocalLlmAcpLimits;
}

/** What a host was told, each field optional. */
export interface LocalLlmOverrides {
  baseUrl?: string;
  model?: string;
  apiKey?: string;
}

export interface LocalLlmAcpOverrides extends LocalLlmOverrides {
  limits?: LocalLlmAcpLimits;
}

function given(value: string | undefined): string | undefined {
  const trimmed = value?.trim();
  return trimmed === undefined || trimmed.length === 0 ? undefined : trimmed;
}

function positiveInteger(value: string | undefined): number | undefined {
  const read = given(value);
  if (read === undefined || !/^\d+$/u.test(read)) return undefined;
  const parsed = Number(read);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : undefined;
}

function positiveNumber(value: string | undefined): number | undefined {
  const read = given(value);
  if (read === undefined) return undefined;
  const parsed = Number(read);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : undefined;
}

function share(value: number | undefined): number | undefined {
  return value !== undefined && Number.isFinite(value) && value > 0 && value <= 1 ? value : undefined;
}

function shareFromText(value: string | undefined): number | undefined {
  return share(positiveNumber(value));
}

/** Each setting from the host where it said one, else from the
 * environment, else the default. An empty value is no value: a setting
 * cleared in the editor falls back rather than sending an empty key. */
export function resolveLocalLlmSettings(
  overrides: LocalLlmOverrides = {},
  environment: Readonly<Record<string, string | undefined>> = process.env,
): LocalLlmSettings {
  const apiKey = given(overrides.apiKey) ?? given(environment[LOCAL_LLM_ENVIRONMENT.apiKey]);
  const model = given(overrides.model) ?? given(environment[LOCAL_LLM_ENVIRONMENT.model]);
  return {
    baseUrl: given(overrides.baseUrl) ?? given(environment[LOCAL_LLM_ENVIRONMENT.baseUrl]) ?? LOCAL_LLM_DEFAULT_BASE_URL,
    ...(model !== undefined ? { model } : {}),
    ...(apiKey !== undefined ? { apiKey } : {}),
  };
}

/** Resolves settings for the ACP-flavored local coding agent. */
export function resolveLocalLlmAcpSettings(
  overrides: LocalLlmAcpOverrides = {},
  environment: Readonly<Record<string, string | undefined>> = process.env,
): LocalLlmAcpSettings {
  const base = resolveLocalLlmSettings(overrides, environment);
  const resolvedLimits: LocalLlmAcpLimits = {
    maxIterations:
      overrides.limits?.maxIterations
      ?? positiveInteger(environment[LOCAL_LLM_ACP_ENVIRONMENT.maxIterations]),
    maxToolCalls:
      overrides.limits?.maxToolCalls
      ?? positiveInteger(environment[LOCAL_LLM_ACP_ENVIRONMENT.maxToolCalls]),
    maxSeconds:
      overrides.limits?.maxSeconds
      ?? positiveInteger(environment[LOCAL_LLM_ACP_ENVIRONMENT.maxSeconds]),
    commandTimeoutSeconds:
      overrides.limits?.commandTimeoutSeconds
      ?? positiveInteger(environment[LOCAL_LLM_ACP_ENVIRONMENT.commandTimeoutSeconds]),
    maxCommandOutputChars:
      overrides.limits?.maxCommandOutputChars
      ?? positiveInteger(environment[LOCAL_LLM_ACP_ENVIRONMENT.maxCommandOutputChars]),
    maxPromptTokens:
      overrides.limits?.maxPromptTokens
      ?? positiveInteger(environment[LOCAL_LLM_ACP_ENVIRONMENT.maxPromptTokens]),
    maxCompletionTokens:
      overrides.limits?.maxCompletionTokens
      ?? positiveInteger(environment[LOCAL_LLM_ACP_ENVIRONMENT.maxCompletionTokens]),
    maxTotalTokens:
      overrides.limits?.maxTotalTokens
      ?? positiveInteger(environment[LOCAL_LLM_ACP_ENVIRONMENT.maxTotalTokens]),
    maxContextUsedTokens:
      overrides.limits?.maxContextUsedTokens
      ?? positiveInteger(environment[LOCAL_LLM_ACP_ENVIRONMENT.maxContextUsedTokens]),
    maxContextWindowTokens:
      overrides.limits?.maxContextWindowTokens
      ?? positiveInteger(environment[LOCAL_LLM_ACP_ENVIRONMENT.maxContextWindowTokens]),
    maxContextShare:
      share(overrides.limits?.maxContextShare)
      ?? shareFromText(environment[LOCAL_LLM_ACP_ENVIRONMENT.maxContextShare]),
    minFreeContextTokens:
      overrides.limits?.minFreeContextTokens
      ?? positiveInteger(environment[LOCAL_LLM_ACP_ENVIRONMENT.minFreeContextTokens]),
  };

  const limits = Object.fromEntries(
    Object.entries(resolvedLimits).filter(([, value]) => value !== undefined),
  ) as LocalLlmAcpLimits;

  return { ...base, limits };
}

/** Where a run's model came from, said in its first update. */
export type LocalLlmModelSource = "stage" | "settings" | "server" | "default";

export interface ResolvedLocalLlmModel {
  model: string;
  source: LocalLlmModelSource;
}

/** The models endpoint of a base URL, written either way, as
 * `chatCompletionsUrl` reads it. */
export function modelsUrl(baseUrl: string): string {
  const base = baseUrl.trim().replace(/\/+$/u, "");
  return /\/v1$/u.test(base) ? `${base}/models` : `${base}/v1/models`;
}

const SERVED_MODELS_TIMEOUT_MS = 10_000;
const servedModels = new Map<string, Promise<string[] | undefined>>();

/** The models the server lists at `/v1/models`, asked once per base URL
 * for the life of the process, so a chain asks once. Undefined where the
 * server could not be asked or answered with no list. */
export function listServedModels(
  settings: Pick<LocalLlmSettings, "baseUrl" | "apiKey">,
  fetchImpl: (input: string, init?: RequestInit) => Promise<Response>,
): Promise<string[] | undefined> {
  const url = modelsUrl(settings.baseUrl);
  let pending = servedModels.get(url);
  if (pending === undefined) {
    pending = (async () => {
      try {
        const response = await fetchImpl(url, {
          headers: localLlmHeaders(settings),
          signal: AbortSignal.timeout(SERVED_MODELS_TIMEOUT_MS),
        });
        if (!response.ok) return undefined;
        const body = (await response.json()) as { data?: Array<{ id?: unknown }> };
        const ids = (body.data ?? []).map((entry) => entry.id).filter((id): id is string => typeof id === "string" && id.length > 0);
        return ids.length > 0 ? ids : undefined;
      } catch {
        return undefined;
      }
    })();
    servedModels.set(url, pending);
    // A failed answer is not kept: the server may be up at the next run.
    void pending.then((ids) => {
      if (ids === undefined) servedModels.delete(url);
    });
  }
  return pending;
}

/** The model a local LLM run uses (local-llm-codes-in-process, ADR 0038
 * decision 5): the stage's, else the settings', else the one the server
 * serves (the first, where it serves several), else `default`. */
export async function resolveLocalLlmModel(
  stageModel: string | undefined,
  settings: LocalLlmSettings,
  fetchImpl: (input: string, init?: RequestInit) => Promise<Response>,
): Promise<ResolvedLocalLlmModel> {
  const fromStage = given(stageModel);
  if (fromStage !== undefined) return { model: fromStage, source: "stage" };
  const fromSettings = given(settings.model);
  if (fromSettings !== undefined) return { model: fromSettings, source: "settings" };
  const served = await listServedModels(settings, fetchImpl);
  if (served?.[0] !== undefined) return { model: served[0], source: "server" };
  return { model: LOCAL_LLM_DEFAULT_MODEL, source: "default" };
}

/** The sentence a run starts with, naming its model and why that one. */
export function describeLocalLlmModel(resolved: ResolvedLocalLlmModel): string {
  const why: Record<LocalLlmModelSource, string> = {
    stage: "named by the stage",
    settings: "named in the local LLM settings",
    server: "the model the server serves",
    default: "no model was named and the server listed none",
  };
  return `Model ${resolved.model} (${why[resolved.source]}).`;
}

/** Variables a host with no settings of its own reads for the agents. */
export const AGENT_ENVIRONMENT = {
  ignoreSystemProxy: "OPENSPEC_UI_IGNORE_SYSTEM_PROXY",
  askBeforeCommands: "OPENSPEC_UI_LOCAL_LLM_ASK_BEFORE_COMMANDS",
} as const;

/** A switch from the environment: `1`, `true`, `yes` or `on`, in any case. */
export function switchFromEnvironment(value: string | undefined): boolean {
  return /^(1|true|yes|on)$/iu.test(value?.trim() ?? "");
}

/** The chat completions endpoint of a base URL written either way an
 * OpenAI-compatible server's documentation writes it: with its `/v1` or
 * without. Appending `/v1/chat/completions` to a base that already ended
 * in `/v1` asked for `/v1/v1/chat/completions`. */
export function chatCompletionsUrl(baseUrl: string): string {
  const base = baseUrl.trim().replace(/\/+$/u, "");
  return /\/v1$/u.test(base) ? `${base}/chat/completions` : `${base}/v1/chat/completions`;
}

/** The request headers for the server: JSON, and the key where there is
 * one. */
export function localLlmHeaders(settings: Pick<LocalLlmSettings, "apiKey">): Record<string, string> {
  return {
    "content-type": "application/json",
    ...(settings.apiKey !== undefined ? { authorization: `Bearer ${settings.apiKey}` } : {}),
  };
}
