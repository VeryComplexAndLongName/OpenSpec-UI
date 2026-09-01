// Pure type + constant, deliberately its own leaf module with zero
// imports (see browser.ts's header comment on the browser-safe export
// surface). `protocol.ts` needs `HarnessStage`/`STAGES` to validate
// `stageCompleted`/`checkpoint` events, but must not pull in
// `harness-config.ts`'s Node-only dependencies (`node:fs/promises`,
// `node:path`) into the browser client bundle — see
// packages/server/src/static.test.ts, which builds that bundle with
// esbuild and fails loudly if a Node built-in leaks into the graph.

export type HarnessStage = "propose" | "review" | "apply" | "verify" | "archive" | "git";

/** Runtime enumeration of `HarnessStage`, kept in this one place so
 * `harness-config.ts`'s validation and `protocol.ts`'s `isEvent()`
 * boundary check never hand-maintain their own separate copy. */
export const STAGES: readonly HarnessStage[] = ["propose", "review", "apply", "verify", "archive", "git"];
