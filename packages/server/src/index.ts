// Точка входа @openspec-ui/server — тонкий REST/WS слой над
// @openspec-ui/core. Бизнес-логики здесь нет (см.
// openspec/changes/standalone-app/spec.md).

export { createServer, DEFAULT_HOST, DEFAULT_PORT, type OpenSpecUiServer, type ServerOptions } from "./server.js";
export {
  buildDefaultAllowlist,
  buildDefaultAgentRunners,
  resolveRunner,
  DEFAULT_AGENT_ID,
} from "@openspec-ui/core";
export { isCommandLike } from "./wire.js";
