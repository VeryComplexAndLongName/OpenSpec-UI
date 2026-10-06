// Where this editor says the local LLM is, read in one place
// (the-local-model-is-offered-where-it-is-set).
//
// The runners already read the settings and the secret storage when they are
// built. Agent detection did not: it was called with nothing, so it looked
// for the local LLM at the environment's address or `http://localhost:30000`,
// and a server named in `openspec-ui.localLlm.baseUrl` was never found - the
// Agentic Harness setup, the AI panel and the repository-setup facts did not
// offer `local-llm` or `local-llm-acp` at all. Both now read from here, at the
// moment they ask, so a setting changed since the window opened counts.

import * as vscode from "vscode";
import {
  detectAvailableAgents,
  detectAvailableAgentsDetailed,
  type AgentDetectionConfig,
  type DetectedAgent,
} from "@openspec-ui/core";

/** Where the local LLM's API key is kept: the editor's secret storage, by
 * this name (the-local-llm-is-where-you-say). */
export const LOCAL_LLM_API_KEY_SECRET = "openspec-ui.localLlm.apiKey";

let secretStorage: vscode.SecretStorage | undefined;

/** Called once, on activation: the storage the key is read from. */
export function useSecretStorage(storage: vscode.SecretStorage): void {
  secretStorage = storage;
}

/** The two agent switches, from the settings, for every place this host
 * builds runners (ADR 0038). Off unless a person turned them on; the
 * environment's values apply only to a host with no settings. */
export function readAgentSwitches(): { ignoreSystemProxy: boolean; askBeforeCommands: boolean } {
  const agents = vscode.workspace.getConfiguration("openspec-ui.agents");
  const localAgent = vscode.workspace.getConfiguration("openspec-ui.localLlm.agent");
  return {
    ignoreSystemProxy: agents.get<boolean>("ignoreSystemProxy", false) === true,
    askBeforeCommands: localAgent.get<boolean>("askBeforeCommands", false) === true,
  };
}

/** Where the local LLM is and its key: the settings and the secret storage.
 * What is not set here is left out, and core falls back to the environment
 * (the-local-llm-is-where-you-say). The key is never written to a file. */
export async function readLocalLlmSettings(): Promise<{ localLlmBaseUrl?: string; localLlmModel?: string; localLlmApiKey?: string }> {
  const localLlm = vscode.workspace.getConfiguration("openspec-ui.localLlm");
  const localLlmBaseUrl = (localLlm.get<string>("baseUrl", "") ?? "").trim();
  const localLlmModel = (localLlm.get<string>("model", "") ?? "").trim();
  const localLlmApiKey = secretStorage === undefined
    ? undefined
    : await Promise.resolve(secretStorage.get(LOCAL_LLM_API_KEY_SECRET)).then((value) => value, () => undefined);
  return {
    ...(localLlmBaseUrl.length > 0 ? { localLlmBaseUrl } : {}),
    ...(localLlmModel.length > 0 ? { localLlmModel } : {}),
    ...(localLlmApiKey !== undefined && localLlmApiKey.length > 0 ? { localLlmApiKey } : {}),
  };
}

/** What agent detection is asked with: where the local LLM is, its key, and
 * whether it is reached past the system proxy, as its agents will reach it. */
export async function readAgentDetectionConfig(): Promise<AgentDetectionConfig> {
  const { localLlmBaseUrl, localLlmApiKey } = await readLocalLlmSettings();
  return {
    ...(localLlmBaseUrl !== undefined ? { localLlmBaseUrl } : {}),
    ...(localLlmApiKey !== undefined ? { localLlmApiKey } : {}),
    ignoreSystemProxy: readAgentSwitches().ignoreSystemProxy,
  };
}

/** Which agents are here, with the local LLM looked for where the settings
 * say it is. */
export async function detectAgentsHere(): Promise<Record<string, boolean>> {
  return detectAvailableAgents(await readAgentDetectionConfig());
}

/** The same, with each CLI's version. */
export async function detectAgentsHereDetailed(): Promise<Record<string, DetectedAgent>> {
  return detectAvailableAgentsDetailed(await readAgentDetectionConfig());
}
