import { formatMessage, readChangeTaskRows, say } from "@openspec-ui/core";

export interface ReportOptions {
  workspaceRoot: string;
  changeName?: string;
  format: "text" | "json";
}

export interface ReportIo {
  stdout: (line: string) => void;
  stderr: (line: string) => void;
}

export class ReportRefusal extends Error {}

export function reportFailure(command: string, error: unknown, io: ReportIo): number {
  const refused = error instanceof ReportRefusal;
  io.stderr(formatMessage(say(refused ? "OSW-CLI-017" : "OSW-CLI-018", {
    command, reason: error instanceof Error ? error.message : String(error),
  })));
  return refused ? 1 : 2;
}

export async function reportCommand<T>(
  command: string, options: ReportOptions, io: ReportIo,
  read: () => Promise<T>, text: (report: T) => string,
): Promise<number> {
  try {
    const result = await read();
    io.stdout(options.format === "json" ? JSON.stringify(result, null, 2) : text(result));
    return 0;
  } catch (error) {
    return reportFailure(command, error, io);
  }
}

export async function changeSource(options: ReportOptions) {
  const result = await readChangeTaskRows({ repositoryRoot: options.workspaceRoot, changeName: options.changeName! });
  if (!result.ok) throw new ReportRefusal(result.reason);
  return result;
}