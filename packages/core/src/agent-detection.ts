// Best-effort presence check for each registered agent's underlying CLI
// (or, for the local LLM, its HTTP endpoint) — see
// openspec/changes/agent-detection/design.md. Reuses
// `buildDefaultAllowlist()`'s executable names as the single source of
// truth (not a second hardcoded id->executable map); `cross-spawn` for
// the same Windows `.cmd`/`.bat` shim resolution reason `agents/shared.ts`
// already documents. A detected agent is not guaranteed to actually work
// (it could still be unauthenticated) — this is a presence signal only.

import crossSpawn from "cross-spawn";
import { buildDefaultAllowlist } from "./default-runners.js";

const HTTP_SENTINEL = "__http__";
const SPAWN_TIMEOUT_MS = 3000;
const HTTP_TIMEOUT_MS = 1500;

export interface AgentDetectionConfig {
  localLlmBaseUrl?: string;
}

function detectCliAgent(executable: string): Promise<boolean> {
  return new Promise((resolve) => {
    let settled = false;
    const finish = (result: boolean) => {
      if (settled) return;
      settled = true;
      resolve(result);
    };

    let child;
    try {
      child = crossSpawn(executable, ["--version"], { stdio: "ignore" });
    } catch {
      finish(false);
      return;
    }

    const timer = setTimeout(() => {
      child.kill();
      finish(false);
    }, SPAWN_TIMEOUT_MS);

    child.on("error", () => {
      clearTimeout(timer);
      finish(false);
    });
    child.on("exit", () => {
      clearTimeout(timer);
      // Exit code is intentionally not checked — some CLIs exit non-zero
      // on `--version` (e.g. when it also validates auth); the fact that
      // the process spawned and ran at all is what "detected" means here.
      finish(true);
    });
  });
}

async function detectLocalLlm(baseUrl: string): Promise<boolean> {
  try {
    await fetch(baseUrl, { signal: AbortSignal.timeout(HTTP_TIMEOUT_MS) });
    return true;
  } catch {
    return false;
  }
}

/** Returns, for every id in `AGENT_REGISTRY`, whether that agent's CLI (or
 * HTTP endpoint) appears to be present on this machine. Runs all checks
 * in parallel — total wall time is bounded by the slowest single check
 * (a few seconds), not the sum. */
export async function detectAvailableAgents(
  config: AgentDetectionConfig = {},
): Promise<Record<string, boolean>> {
  const allowlist = buildDefaultAllowlist();
  const entries = await Promise.all(
    Object.entries(allowlist).map(async ([id, rules]) => {
      const executable = rules[0]?.executable;
      if (!executable) return [id, false] as const;
      if (executable === HTTP_SENTINEL) {
        return [id, await detectLocalLlm(config.localLlmBaseUrl ?? "http://localhost:30000")] as const;
      }
      return [id, await detectCliAgent(executable)] as const;
    }),
  );
  return Object.fromEntries(entries);
}
