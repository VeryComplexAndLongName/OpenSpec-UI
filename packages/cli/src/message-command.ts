import { isMessageCode, MESSAGES, messageEntryUrl, type MessageEntry } from "@openspec-ui/core";
import { reportCommand, type ReportIo, type ReportOptions } from "./report-command.js";

export function explainMessageCommand(options: ReportOptions, io: ReportIo) {
  return reportCommand("explain message", options, io, async () => {
    if (!isMessageCode(options.changeName)) throw new Error(`Unknown message code: ${options.changeName}`);
    const entry: MessageEntry = MESSAGES[options.changeName];
    return { code: options.changeName, ...entry, url: messageEntryUrl(options.changeName) };
  }, (entry) => `${entry.code} (${entry.level}${entry.retired ? ", retired" : ""})\n${entry.text}\nWhy: ${entry.why}\nWhat to do: ${entry.todo}${entry.retired ? `\nRetired: ${entry.retired}` : ""}\n${entry.url}`);
}