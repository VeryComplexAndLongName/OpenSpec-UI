// Browser-safe поверхность экспорта: только протокол команд/событий и
// статический реестр агентов — ничто отсюда не импортирует Node built-ins
// (`node:child_process`, `node:fs`, `simple-git`).
//
// `webui`'s браузерный бандл (packages/webui/src/standalone-entry.tsx через
// packages/server/scripts/build-client.mjs) импортирует из
// `@openspec-ui/core/browser`, а не из корневого барреля — барrel
// (`@openspec-ui/core`) тянет за собой `git.ts`/`openspec.ts`/`agents/*.ts`,
// которые не бандлятся для браузера (см.
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
