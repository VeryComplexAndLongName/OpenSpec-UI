import os from "node:os";
import { createGitWrapper, loadOrCreateMachineKey, messageDirectoryBeside, readAgentStatuses,
  readGitAuthor, resolveAgentStatusDirectory, sendMessage, type MachineKey } from "@openspec-ui/core";
import { reportCommand, ReportRefusal, type ReportIo, type ReportOptions } from "./report-command.js";

export interface SendOptions extends ReportOptions { words: string }

export interface NoteDeps {
  directory?: () => Promise<string>;
  read?: typeof readAgentStatuses;
  loadKey?: () => Promise<MachineKey>;
  tty?: boolean;
  agent?: string;
  gitAuthor?: string;
}

export async function queueNote(options: SendOptions, deps: NoteDeps = {}) {
  if (!options.words.trim()) throw new Error("A message needs non-blank text.");
  const directory = await (deps.directory ?? (() => resolveAgentStatusDirectory(createGitWrapper({ cwd: options.workspaceRoot }), options.workspaceRoot)))();
  const { reports } = await (deps.read ?? readAgentStatuses)(directory);
  const target = reports.find((report) => report.instanceId === options.changeName && !report.gone && report.signature !== "does-not-check-out");
  if (!target) throw new ReportRefusal(`No live run has instanceId ${options.changeName}.`);
  const author = (deps.agent ?? (process.env.OPENSPEC_UI_AGENT || process.env.AI_AGENT)) || !(deps.tty ?? process.stdin.isTTY) ? "run" : "person";
  const messageId = await sendMessage({
    directory: messageDirectoryBeside(directory), to: target.instanceId, toKind: "run",
    kind: "note", author, words: options.words, key: await (deps.loadKey ?? loadOrCreateMachineKey)(),
    machine: os.hostname(), gitAuthor: deps.gitAuthor ?? await readGitAuthor(options.workspaceRoot),
  });
  return { messageId, to: target.instanceId, author, status: "queued" };
}

export function sendMessageCommand(options: SendOptions, io: ReportIo, queue = queueNote) {
  return reportCommand("send message", options, io, () => queue(options), (result) =>
    `${result.messageId}: queued for ${result.to} (author ${result.author}); receipt is not confirmed.`);
}