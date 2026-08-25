// Entry point for @openspec-ui/server — a thin REST/WS layer over
// @openspec-ui/core. There is no business logic here (see
// openspec/changes/standalone-app/spec.md).

export { createServer, DEFAULT_HOST, DEFAULT_PORT, type OpenSpecUiServer, type ServerOptions } from "./server.js";
export {
  buildDefaultAllowlist,
  buildDefaultAgentRunners,
  resolveRunner,
  DEFAULT_AGENT_ID,
} from "@openspec-ui/core";
export { isCommandLike } from "./wire.js";
