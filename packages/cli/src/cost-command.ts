import { ChangeUsageRefusal, readChangeUsageReport, type UsageTotal } from "@openspec-ui/core";
import { ReportRefusal, reportCommand, type ReportIo, type ReportOptions } from "./report-command.js";

export async function readCostReport(options: ReportOptions) {
  try {
    return await readChangeUsageReport({ workspaceRoot: options.workspaceRoot, changeName: options.changeName! });
  } catch (error) {
    if (error instanceof ChangeUsageRefusal) throw new ReportRefusal(error.message);
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
  return `${name}: ${parts.join(", ")}`;
}

export function showCostCommand(options: ReportOptions, io: ReportIo, read = readCostReport) {
  return reportCommand("show cost", options, io, () => read(options), (result) => [
    `Recorded usage for ${result.changeName}${result.archiveName ? ` (archive ${result.archiveName})` : ""}: ${result.recordedRunCount} runs, ${result.unmeasuredRunCount} unmeasured runs, ${result.unmeasuredInvocationCount} unmeasured invocations`,
    ...Object.entries(result.totalsByAgent).map(([name, total]) => describeTotal(name, total)),
    ...Object.entries(result.totalsByModel).map(([name, total]) => describeTotal(`model ${name}`, total)),
  ].join("\n"));
}
