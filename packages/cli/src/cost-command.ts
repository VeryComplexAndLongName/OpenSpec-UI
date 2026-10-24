import { ChangeUsageRefusal, formatMessage, readChangeUsageReport, say, withMessageCode, type UsageTotal } from "@openspec-ui/core";
import { ReportRefusal, reportCommand, type ReportIo, type ReportOptions } from "./report-command.js";

export async function readCostReport(options: ReportOptions) {
  try {
    return await readChangeUsageReport({ workspaceRoot: options.workspaceRoot, changeName: options.changeName! });
  } catch (error) {
    if (error instanceof ChangeUsageRefusal) throw new ReportRefusal(withMessageCode(error.message, error.code));
    throw error;
  }
}

function describeTotal(name: string, total: UsageTotal): string {
  const parts = [`${total.inputTokens} input`, `${total.outputTokens} output`];
  if (total.cacheReadInputTokens !== undefined) parts.push(`${total.cacheReadInputTokens} cache read`);
  if (total.cacheCreationInputTokens !== undefined) parts.push(`${total.cacheCreationInputTokens} cache creation`);
  if (total.thoughtTokens !== undefined) parts.push(`${total.thoughtTokens} thought`);
  parts.push(total.costUsd === undefined ? "USD not reported" : `USD ${total.costUsd} (reported for ${total.costReportedInvocationCount}/${total.invocationCount} measured invocations)`);
  for (const [unit, amount] of Object.entries(total.costByUnit)) parts.push(`${unit} ${amount}`);
  if (total.currentModelAttributionInvocationCount) {
    parts.push(`${total.currentModelAttributionInvocationCount} invocations use vendor current-model attribution; an exact model split is unavailable`);
  }
  return formatMessage(say("OSW-CLI-101", { name, details: parts.join(", ") }));
}

export function showCostCommand(options: ReportOptions, io: ReportIo, read = readCostReport) {
  return reportCommand("show cost", options, io, () => read(options), (result) => [
    formatMessage(say("OSW-CLI-102", {
      change: result.changeName, archive: result.archiveName ? ` (archive ${result.archiveName})` : "",
      runs: result.recordedRunCount, unmeasuredRuns: result.unmeasuredRunCount,
      unmeasuredInvocations: result.unmeasuredInvocationCount,
    })),
    ...Object.entries(result.totalsByAgent).map(([name, total]) => describeTotal(name, total)),
    ...Object.entries(result.totalsByModel).map(([name, total]) => describeTotal(`model ${name}`, total)),
  ].join("\n"));
}
