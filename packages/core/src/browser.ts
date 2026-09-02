// Browser-safe export surface: only the command/event protocol and the
// static agent registry — nothing here imports Node built-ins
// (`node:child_process`, `node:fs`, `simple-git`).
//
// `webui`'s browser bundle (packages/webui/src/standalone-entry.tsx via
// packages/server/scripts/build-client.mjs) imports from
// `@openspec-ui/core/browser`, not from the root barrel — the barrel
// (`@openspec-ui/core`) pulls in `git.ts`/`openspec.ts`/`agents/*.ts`,
// which are not bundled for the browser (see
// openspec/changes/standalone-app/tasks.md 2.1).

export * from "./protocol.js";
export { AGENT_REGISTRY, DEFAULT_AGENT_ID, type AgentDescriptor } from "./agents/registry.js";
export type { ChangeState } from "./change-state.js";
export type {
  CatalogTemplate,
  TemplateArtifacts,
  TemplateManifest,
  TemplateVariable,
} from "./template-catalog.js";
export type { ChangeTimeline, ChangeTimelineSpec, ChangeTimelineTask } from "./change-timeline.js";
export type {
  HarnessAutonomyLevel,
  HarnessBudget,
  HarnessCheckpoints,
  HarnessConfig,
  HarnessReviewGate,
  HarnessReviewGateMode,
  HarnessStage,
} from "./harness-config.js";
// HarnessStepAgent(s)/normalizeStepAgent come from their own zero-Node-
// import leaf module, not from harness-config.js, for the same reason
// resolveRunWithHarnessTarget comes from harness-dispatch.js below — see
// harness-step-agent.ts's header comment.
export {
  COPILOT_MIN_AI_CREDITS,
  HARNESS_AGENT_CAPABILITIES,
  HARNESS_EFFORT_VALUES,
  isHarnessStepAgentStage,
  normalizeStepAgent,
  stepAgentFor,
  VSCODE_CHAT_STEP_AGENT_ID,
  type HarnessAgentCapabilities,
  type HarnessEffort,
  type HarnessStepAgent,
  type HarnessStepAgentStage,
  type HarnessStepAgents,
  type HarnessStepBudget,
} from "./harness-step-agent.js";
// resolveRunWithHarnessTarget is a real value export (not just a type) —
// imported from its own zero-Node-import leaf module, not from
// harness-config.js, which would pull that module's node:fs/node:path
// imports into this browser bundle. See harness-dispatch.ts.
export { resolveRunWithHarnessTarget, type RunWithHarnessTarget } from "./harness-dispatch.js";
// Pure date math, no git/fs access — safe for the browser bundle (see the
// file header comment for why this differs from change-timeline.js's
// runtime exports, which stay Node-only).
export * from "./stale-tasks.js";
// Both zero-Node-import leaf modules (see each file's own header comment)
// — safe for the browser bundle. usage-report.ts is NOT re-exported here:
// it imports AuditEntry from security.ts, which pulls in node:fs/node:path.
export * from "./agent-usage.js";
export * from "./verified-agent-versions.js";
