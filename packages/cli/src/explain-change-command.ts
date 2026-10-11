import path from "node:path";
import { buildHints, resolveHarnessConfig, WORKSPACE_LEASE_STALE_AFTER_MS,
  readChangeHistory, readChangeStage, openQuestions, readChangeReadiness } from "@openspec-ui/core";
import { changeSource, reportCommand, type ReportIo, type ReportOptions } from "./report-command.js";

export async function readExplanation(options: ReportOptions) {
  const source = await changeSource(options);
  const [history, stage, questions, readiness] = await Promise.all([
    readChangeHistory(source.path, options.changeName!), readChangeStage(source.path, options.changeName!),
    openQuestions(path.join(source.path, "openspec", "changes", options.changeName!)), readChangeReadiness({ workspaceRoot: options.workspaceRoot }),
  ]);
  const config = await resolveHarnessConfig(source.path, options.changeName);
  return { changeName: options.changeName, path: source.path, history, stage, questions,
    tasks: source.rows, readiness: readiness.changes.find((item) => item.changeName === options.changeName),
    advice: config.hints?.enabled === false ? [] : buildHints(readiness, { staleAfterMs: WORKSPACE_LEASE_STALE_AFTER_MS }) };
}

export function explainChangeCommand(options: ReportOptions, io: ReportIo, read = readExplanation) {
  return reportCommand("explain change", options, io, () => read(options), (result) => JSON.stringify(result, null, 2));
}