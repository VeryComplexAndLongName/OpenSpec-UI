import { acceptsModel, AGENT_REGISTRY, HARNESS_AGENT_CAPABILITIES } from "@openspec-ui/core";
import { reportCommand, type ReportIo, type ReportOptions } from "./report-command.js";

export function showAgentsCommand(options: ReportOptions, io: ReportIo) {
  return reportCommand("show agents", options, io, async () => AGENT_REGISTRY.map((agent) => ({
    ...agent, capabilities: HARNESS_AGENT_CAPABILITIES[agent.id as keyof typeof HARNESS_AGENT_CAPABILITIES],
    acceptsModel: acceptsModel(agent),
    authentication: "not checked",
  })), (agents) => agents.map((agent) => `${agent.id} ${agent.label} provider=${agent.provider} acceptsModel=${agent.acceptsModel}${agent.modelFlag ? ` modelFlag=${agent.modelFlag}` : ""}\n${JSON.stringify(agent.capabilities)}; authentication not checked`).join("\n"));
}
