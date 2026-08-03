// 2.1 Прямой импорт `execution-core` в extension host — реестр
// `AgentRunner`'ов строится напрямую из `@openspec-ui/core`, без сети (см.
// ADR 0001 п.2, spec.md "Primary mode is direct-core integration").

import { buildDefaultAgentRunners, type AgentRunner } from "@openspec-ui/core";
import type { ExtensionConfig } from "./config.js";

export function createRunnersForWorkspace(workspaceRoot: string, config: ExtensionConfig): Map<string, AgentRunner> {
  return buildDefaultAgentRunners({
    workspaceRoot,
    localLlmBaseUrl: config.localLlmBaseUrl,
    localLlmModel: config.localLlmModel,
  });
}
