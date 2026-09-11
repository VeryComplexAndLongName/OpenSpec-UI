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

/** The steps a change may declare in its own chain — ADR 0021. A closed
 * list, like `STAGES`: a declaration selects one of these names, and the
 * behaviour behind each is a function this repository owns
 * (`chain-steps.ts`). A change file never names something to execute.
 *
 * Deliberately NOT members of `HarnessStage`. Every type derived from
 * that union would gain them, and `HarnessStepAgentStage` used to be a
 * blocklist over it — a step name would have become a valid `stepAgents`
 * key, a setting nothing reads, accepted without complaint. */
export type ChainStepName = "await-change";

export const CHAIN_STEP_NAMES: readonly ChainStepName[] = ["await-change"];

/** Either half of what a chain runs. The protocol's `stage` fields carry
 * this, so a declared step travels the same timeline as the stages
 * around it and no surface needs a new event kind to render one. */
export type ChainPart = HarnessStage | ChainStepName;

export function isChainStepName(value: string): value is ChainStepName {
  return (CHAIN_STEP_NAMES as readonly string[]).includes(value);
}

export function isChainPart(value: string): value is ChainPart {
  return (STAGES as readonly string[]).includes(value) || isChainStepName(value);
}
