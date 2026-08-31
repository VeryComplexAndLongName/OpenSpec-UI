// Pure function, deliberately its own leaf module with zero non-type
// imports — same reasoning as harness-stage.ts. `resolveRunWithHarnessTarget`
// must be importable from `@openspec-ui/core/browser` (the standalone
// shell's "Run with Agentic Harness" button resolves a `HarnessConfig`
// over HTTP, then needs this decision client-side), but `harness-config.ts`
// itself has top-level `node:fs/promises`/`node:path` imports for its
// other exports (readGlobalHarnessConfig, etc.) — re-exporting a value
// (not just a type) FROM that module would force the browser bundle to
// actually load it at runtime, pulling those Node built-ins in with it
// (caught by packages/server/src/static.test.ts, which builds the bundle
// with esbuild and fails loudly on exactly this).

import type { HarnessAutonomyLevel } from "./harness-config.js";

export type RunWithHarnessTarget = "picker" | "chain";

/** The single decision "Run with Agentic Harness" (`agentic-harness-run-
 * menu`) makes: `assisted` opens the existing single-stage picker
 * (unchanged behavior — a human still explicitly starts each stage);
 * `semi-autonomous`/`autonomous` start a `"chain"` command instead. Pure
 * and browser-safe (no I/O) so both hosts share one implementation
 * instead of re-deriving it — the extension host resolves `HarnessConfig`
 * directly (a Node-side core import) before ever revealing a panel;
 * `webui`'s standalone shell resolves it over HTTP first — but either
 * calls this same function on the result, per design.md's "Dispatch...
 * not duplicated per host". */
export function resolveRunWithHarnessTarget(config: { autonomyLevel: HarnessAutonomyLevel }): RunWithHarnessTarget {
  return config.autonomyLevel === "assisted" ? "picker" : "chain";
}
