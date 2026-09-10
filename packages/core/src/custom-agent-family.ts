// Which agents can be given a custom agent, and what one looks like.
//
// Its own leaf module with zero Node imports, for the reason
// `harness-dispatch.ts` and `harness-step-agent.ts` state in their own
// headers: `webui` needs these, and re-exporting a *value* from
// `custom-agents.ts` — which reads directories, so it imports
// `node:fs/promises` — would pull those built-ins into the browser
// bundle. The bundle-safety test caught exactly that when this lived
// there. See custom-agents-are-visible.

import { AGENT_REGISTRY } from "./agents/registry.js";

export type CustomAgentFamily = "claude" | "copilot";

export interface CustomAgent {
  /** What the CLI accepts after its flag — the file's base name. */
  name: string;
  /** From the definition's frontmatter, where it has one. Absent is
   * ordinary: a reader picking between two names benefits from it, and a
   * file without one is still a usable agent. */
  description?: string;
  /** Which registry agents can be given this one. */
  family: CustomAgentFamily;
  /** Where it was found, so a person can open the file that defines it. */
  filePath: string;
  /** Why this one cannot be named in a configuration, when it cannot.
   * A file whose base name would be refused by the same rule
   * `stepAgents.<stage>.customAgent` obeys is reported rather than
   * dropped: the person wrote the file, and "we found it and here is
   * why it is unusable" is the only form of that fact they can act on.
   * Absent on every agent that can be named. See
   * a-name-is-checked-before-it-is-used. */
  refused?: string;
}

/** Which family an agent id belongs to. Derived from the id rather than
 * listed, so an adapter added for either CLI is covered without a second
 * list to forget. */
export function customAgentFamilyFor(agentId: string): CustomAgentFamily | undefined {
  if (agentId.startsWith("claude-cli")) return "claude";
  if (agentId.startsWith("copilot-cli")) return "copilot";
  return undefined;
}

/** The registry agents that can be given a custom agent at all. Offering
 * one for an agent whose CLI cannot take it is the same defect as a
 * ceiling that cannot act. */
export function agentsAcceptingCustomAgents(): string[] {
  return AGENT_REGISTRY.filter((agent) => customAgentFamilyFor(agent.id) !== undefined).map((agent) => agent.id);
}
