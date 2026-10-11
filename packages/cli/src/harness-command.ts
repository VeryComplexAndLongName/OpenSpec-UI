import { HARNESS_AGENT_CAPABILITIES, resolveHarnessConfig } from "@openspec-ui/core";
import { changeSource, reportCommand, type ReportIo, type ReportOptions } from "./report-command.js";

export async function readHarnessReport(options: ReportOptions) {
  const source = await changeSource(options);
  const config = await resolveHarnessConfig(source.path, options.changeName);
  return { path: source.path, config, capabilities: HARNESS_AGENT_CAPABILITIES };
}

export function explainHarnessCommand(options: ReportOptions, io: ReportIo, read = readHarnessReport) {
  return reportCommand("explain change-harness", options, io, () => read(options), (result) =>
    `Effective harness at ${result.path}\n${JSON.stringify(result.config, null, 2)}\nAgent capabilities\n${JSON.stringify(result.capabilities, null, 2)}`);
}