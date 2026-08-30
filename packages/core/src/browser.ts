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
  HarnessConfig,
  HarnessReviewGate,
  HarnessReviewGateMode,
  HarnessStage,
  HarnessStepAgents,
} from "./harness-config.js";
// Pure date math, no git/fs access — safe for the browser bundle (see the
// file header comment for why this differs from change-timeline.js's
// runtime exports, which stay Node-only).
export * from "./stale-tasks.js";
