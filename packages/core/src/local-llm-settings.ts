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

export interface LocalLlmSettings {
  baseUrl: string;
  model: string;
  /** Sent as a bearer token where set; a server that wants none gets none. */
  apiKey?: string;
}

/** What a host was told, each field optional. */
export interface LocalLlmOverrides {
  baseUrl?: string;
  model?: string;
  apiKey?: string;
}

function given(value: string | undefined): string | undefined {
  const trimmed = value?.trim();
  return trimmed === undefined || trimmed.length === 0 ? undefined : trimmed;
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
