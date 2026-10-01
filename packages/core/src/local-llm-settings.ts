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

export const LOCAL_LLM_ACP_DEFAULT_EXECUTABLE = "coding-agent";

export interface LocalLlmSettings {
  baseUrl: string;
  model: string;
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
  executable: string;
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

/** Each setting from the host where it said one, else from the
 * environment, else the default. An empty value is no value: a setting
 * cleared in the editor falls back rather than sending an empty key. */
export function resolveLocalLlmSettings(
  overrides: LocalLlmOverrides = {},
  environment: Readonly<Record<string, string | undefined>> = process.env,
): LocalLlmSettings {
  const apiKey = given(overrides.apiKey) ?? given(environment[LOCAL_LLM_ENVIRONMENT.apiKey]);
  return {
    baseUrl: given(overrides.baseUrl) ?? given(environment[LOCAL_LLM_ENVIRONMENT.baseUrl]) ?? LOCAL_LLM_DEFAULT_BASE_URL,
    model: given(overrides.model) ?? given(environment[LOCAL_LLM_ENVIRONMENT.model]) ?? LOCAL_LLM_DEFAULT_MODEL,
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
      overrides.limits?.maxContextShare
      ?? positiveNumber(environment[LOCAL_LLM_ACP_ENVIRONMENT.maxContextShare]),
    minFreeContextTokens:
      overrides.limits?.minFreeContextTokens
      ?? positiveInteger(environment[LOCAL_LLM_ACP_ENVIRONMENT.minFreeContextTokens]),
  };

  const limits = Object.fromEntries(
    Object.entries(resolvedLimits).filter(([, value]) => value !== undefined),
  ) as LocalLlmAcpLimits;

  return {
    ...base,
    executable: LOCAL_LLM_ACP_DEFAULT_EXECUTABLE,
    limits,
  };
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
