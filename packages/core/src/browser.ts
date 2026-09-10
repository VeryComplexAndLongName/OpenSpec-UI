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
// Types and one pure builder — no git, no filesystem, so the browser can
// read a change's dates and say where each came from.
export { buildChangeDates, NO_DATE, UNREADABLE_DATE, normalizedInstant, readDatedFact, withoutArchivePrefix } from "./change-dates.js";
// The chart arithmetic itself, from its own leaf module: pure over the
// timelines the host loaded, with only type imports from the Node-side
// change-timeline.js. It lived in `webui` and had to move — a figure a
// second host wants to print is a figure two hosts would compute twice.
export {
  archivedPerDay,
  describeBasis,
  describeWorkDurationNotCharted,
  FLAT_WORK_SHARE,
  LEAD_BUCKETS,
  leadTimes,
  workDurationBasis,
} from "./change-charts.js";
export type {
  ArchivedPerDay,
  ChartBasis,
  DayCount,
  LeadTimeBucket,
  LeadTimes,
  WorkDurationBasis,
} from "./change-charts.js";
// The one count of a change's open tasks, from the leaf beside the
// checklist reader — the reader itself opens files.
export { openTaskCount } from "./task-checklist-counts.js";
// The audit-log rules, from their own leaf module: pure over entries a
// host read, with only a type import from security.js. Already in this
// bundle by way of workspace-run-stats.js, which reads `changeNameOf`
// from here.
export { changeNameOf, isRunEntry, runTimestampsByChange, VERIFY_CHECKS_AGENT_NAME } from "./audit-runs.js";
// Pure: whether a schedule is due is a comparison, and the browser makes
// it against the same function the hosts do. The file reader stays out —
// it imports `node:fs`.
export {
  checkScheduleTime,
  describeDrop,
  describeLateness,
  describePathNoLongerOffered,
  describeScheduledRunProblem,
  isScheduledRun,
  planScheduleFiring,
  readSchedule,
  withoutEntry,
} from "./scheduled-runs.js";
// Pure over entries the host reads for it, like the run figures beside it.
export { buildVerifyQuality, describeVerifyQuality, ENOUGH_VERIFIES } from "./verify-quality.js";
// From the leaf module, not from the collector beside it: that one reads
// task files, and a value re-exported from it puts `node:fs` in this
// bundle.
export { describeHumanOnlyInbox, describeWaitingOn } from "./human-only-inbox-view.js";
export type { HumanOnlyInbox, HumanOnlyItem, WaitingOn } from "./human-only-inbox-view.js";
export type { AgentQuality, VerifyQuality } from "./verify-quality.js";
export type {
  DroppedRun,
  DueRun,
  KnownChangeNames,
  ScheduleDropReason,
  ScheduleFiring,
  ScheduleReading,
  ScheduledRun,
} from "./scheduled-runs.js";
export type { ChangeDateEvidence, ChangeDateSource, ChangeDates, DatedFact } from "./change-dates.js";
// Pure over a resolved config, with only type imports from the Node-side
// modules — safe in the browser bundle, unlike harness-config.js itself.
export { findHarnessConfigLimits } from "./harness-config-findings.js";
export { changeTemplateConfigToWrite, HARNESS_TEMPLATES, stepAgentsForTemplate, templateConfigToWrite, templatesForScope } from "./harness-templates.js";
export { HARNESS_EFFORT_LEVELS, effortLevelCollisions, resolveEffortLevel } from "./harness-effort-level.js";
export type { HarnessEffortLevel, ResolvedEffort } from "./harness-effort-level.js";
export { recommendTemplate } from "./harness-recommendation.js";
export { buildWorkspaceRunStats, ENOUGH_RUNS } from "./workspace-run-stats.js";
export { recommendFromRunStats } from "./run-recommendations.js";
export { agentsAcceptingCustomAgents, customAgentFamilyFor } from "./custom-agent-family.js";
export type { CustomAgent, CustomAgentFamily } from "./custom-agent-family.js";
export type { RunRecommendation, RunRecommendationGap, RunRecommendationKind, RunRecommendations } from "./run-recommendations.js";
export type { AgentRunGroup, KnownChanges, RunGroupFigures, WorkspaceRunStats } from "./workspace-run-stats.js";
export { agentForChosenPath, buildRunPlan } from "./run-plan.js";
export type { RunPath, RunPathId, RunPlan, RunPlanHost } from "./run-plan.js";
export type { HarnessRecommendation, RecommendationInput } from "./harness-recommendation.js";
export type { HarnessTemplate, HarnessTemplateScope } from "./harness-templates.js";
export type { HarnessFinding, HarnessFindingKind } from "./harness-config-findings.js";
export type {
  HarnessAutonomyLevel,
  HarnessBudget,
  HarnessCheckpoints,
  HarnessConfig,
  HarnessReviewGate,
  HarnessReviewGateMode,
  HarnessStage,
  HarnessTimeout,
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
  mergeStepAgent,
  mergeStepAgents,
  normalizeStepAgent,
  STEP_AGENT_KEYS,
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
