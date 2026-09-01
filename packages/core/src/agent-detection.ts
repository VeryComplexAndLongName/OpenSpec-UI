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

/** Presence plus a best-effort version — see design.md, "Detection
 * reports a version; it does not gate on one". `version` is absent when
 * the probe's output contains no recognizable version token; this never
 * changes `detected`, which still means only "the process spawned and
 * ran". */
export interface DetectedAgent {
  detected: boolean;
  version?: string;
}

/** First version-looking token in `output` (live-confirmed format:
 * `2.1.237 (Claude Code)`) — a run of digits and dots with at least one
 * dot, so a bare integer (e.g. a build number with no dots) is not
 * mistaken for one. Returns `undefined` when no such token exists. */
export function extractVersionToken(output: string): string | undefined {
  const match = /\b\d+(?:\.\d+)+\b/.exec(output);
  return match?.[0];
}

const HTTP_SENTINEL = "__http__";
// 10 s, not the 3 s this used to be: measured on Windows while the machine
// was loaded, `copilot --version` took 4.96-6.51 s and `claude --version`
// 1.61-2.72 s, so a CLI that was installed and working was reported as
// absent (and `claude` only just fit). 10 s is deliberate headroom over
// that measured maximum for a colder start, not a tidy round number to be
// trimmed back later. The cost of the extra headroom is not paid by a
// missing CLI: `cross-spawn` emits an `error` event for an executable it
// cannot find, so a genuinely absent agent still resolves immediately
// rather than waiting out this budget.
const SPAWN_TIMEOUT_MS = 10000;
const HTTP_TIMEOUT_MS = 1500;

export interface AgentDetectionConfig {
  localLlmBaseUrl?: string;
}

/** Spawns `<executable> --version` exactly once (ADR 0017 decision 6 — no
 * second spawn anywhere else pays for this same version). Captures stdout
 * instead of the previous `stdio: "ignore"`, so a version can be read from
 * it best-effort; a probe whose output has no recognizable version token,
 * or that never printed anything, still counts as detected — see
 * `DetectedAgent`'s own doc comment. */
function detectCliAgent(executable: string): Promise<DetectedAgent> {
  return new Promise((resolve) => {
    let settled = false;
    const finish = (result: DetectedAgent) => {
      if (settled) return;
      settled = true;
      resolve(result);
    };

    let child;
    try {
      child = crossSpawn(executable, ["--version"], { stdio: ["ignore", "pipe", "ignore"] });
    } catch {
      finish({ detected: false });
      return;
    }

    let stdout = "";
    child.stdout?.on("data", (chunk: Buffer) => {
      stdout += chunk.toString("utf8");
    });

    const timer = setTimeout(() => {
      child.kill();
      finish({ detected: false });
    }, SPAWN_TIMEOUT_MS);

    child.on("error", () => {
      clearTimeout(timer);
      finish({ detected: false });
    });
    child.on("exit", () => {
      clearTimeout(timer);
      // Exit code is intentionally not checked — some CLIs exit non-zero
      // on `--version` (e.g. when it also validates auth); the fact that
      // the process spawned and ran at all is what "detected" means here.
      finish({ detected: true, version: extractVersionToken(stdout) });
    });
  });
}

async function detectLocalLlm(baseUrl: string): Promise<DetectedAgent> {
  try {
    await fetch(baseUrl, { signal: AbortSignal.timeout(HTTP_TIMEOUT_MS) });
    return { detected: true };
  } catch {
    return { detected: false };
  }
}

/** Returns, for every id in `AGENT_REGISTRY`, whether that agent's CLI (or
 * HTTP endpoint) appears to be present on this machine, and — for a CLI
 * agent — the best-effort version read from the same `--version` probe
 * (see `DetectedAgent`). Runs all checks in parallel — total wall time is
 * bounded by the slowest single check (a few seconds), not the sum. */
export async function detectAvailableAgentsDetailed(
  config: AgentDetectionConfig = {},
): Promise<Record<string, DetectedAgent>> {
  const allowlist = buildDefaultAllowlist();
  const entries = await Promise.all(
    Object.entries(allowlist).map(async ([id, rules]) => {
      const executable = rules[0]?.executable;
      if (!executable) return [id, { detected: false }] as const;
      if (executable === HTTP_SENTINEL) {
        return [id, await detectLocalLlm(config.localLlmBaseUrl ?? "http://localhost:30000")] as const;
      }
      return [id, await detectCliAgent(executable)] as const;
    }),
  );
  return Object.fromEntries(entries);
}

/** The pre-existing, widely-consumed presence-only contract (REST
 * `handleAgentsDetectRequest`, the VS Code webview bridge, `webui`'s
 * agent picker) — unchanged by this file gaining version capture. Kept
 * as its own export, derived from `detectAvailableAgentsDetailed()`
 * rather than duplicating the probes, so callers that only ever checked
 * "is this agent there" (many of them rendering `detected ? ... : ...`
 * directly against the map value) are not asked to switch to the richer
 * shape — see design.md, "Detection reports a version; it does not gate
 * on one": whether an agent counts as detected must not change. */
export async function detectAvailableAgents(
  config: AgentDetectionConfig = {},
): Promise<Record<string, boolean>> {
  const detailed = await detectAvailableAgentsDetailed(config);
  return Object.fromEntries(Object.entries(detailed).map(([id, agent]) => [id, agent.detected]));
}
