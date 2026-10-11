import { readChangeDiff } from "@openspec-ui/core";
import { changeSource, ReportRefusal, reportCommand, type ReportIo, type ReportOptions } from "./report-command.js";

export async function readDiffReport(options: ReportOptions) {
  const source = await changeSource(options);
  const result = await readChangeDiff(source.path, options.changeName!);
  if (result.kind !== "diff") throw new ReportRefusal(result.message);
  return { ...result, path: source.path, scope: "OpenSpec artifacts against HEAD" };
}

export function showDiffCommand(options: ReportOptions, io: ReportIo, read = readDiffReport) {
  return reportCommand("show diff", options, io, () => read(options), (result) =>
    `${result.scope} (${result.path})\n${result.diff || "No artifact changes."}${result.truncated ? "\nDiff truncated." : ""}`);
}