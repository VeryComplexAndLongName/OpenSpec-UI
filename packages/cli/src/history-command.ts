// `openspec-ui-cli history`, `owner`, `implementer` and `send-back` - a
// change's history, and the events a person or their agent records in it
// (a-change-keeps-its-history, ADR 0037).
//
// Presentation only. What an event holds, whether it may be recorded and
// who holds a change are core's (`recordHistoryEvent`, `readChangeHistory`).

import {
  describeHistoryEvent,
  HistoryRefusedError,
  readChangeHistory,
  recordHistoryEvent,
  SEND_BACK_STAGES,
  type ChangeHistory,
  type HistoryActor,
  type HistoryRequest,
  type RecordedEvent,
  type ReopenedTask,
  type SendBackStage,
} from "@openspec-ui/core";

export interface HistoryCommandDeps {
  stdout: (line: string) => void;
  stderr: (line: string) => void;
  /** Test seams. */
  read?: typeof readChangeHistory;
  record?: typeof recordHistoryEvent;
}

function message(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

function rolesLine(history: Pick<ChangeHistory, "roles">): string {
  return `Owner: ${history.roles.owner ?? "nobody"}. Implementer: ${history.roles.implementer ?? "nobody"}.`;
}

/** Exits 0 when every entry keeps the rules, 1 when one does not, and 2
 * when the history could not be read. */
export async function historyCommand(
  options: { workspaceRoot: string; changeName: string; format: "text" | "json" },
  deps: HistoryCommandDeps,
): Promise<number> {
  let history: ChangeHistory;
  try {
    history = await (deps.read ?? readChangeHistory)(options.workspaceRoot, options.changeName);
  } catch (error) {
    deps.stderr(`openspec-ui-cli: could not read the history of ${options.changeName}: ${message(error)}`);
    return 2;
  }
  if (options.format === "json") {
    deps.stdout(JSON.stringify(history, null, 2));
    return history.problems.length === 0 ? 0 : 1;
  }
  deps.stdout(rolesLine(history));
  if (history.entries.length === 0) deps.stdout("No history yet.");
  const refused = new Map(history.problems.map((problem) => [problem.file, problem.problem]));
  for (const entry of history.entries) {
    const said = entry.event === undefined ? entry.file : `${entry.event.at}  ${describeHistoryEvent(entry.event)}`;
    const problem = refused.get(entry.file);
    deps.stdout(problem === undefined ? said : `${said}  [refused: ${problem}]`);
  }
  return history.problems.length === 0 ? 0 : 1;
}

export interface RecordCommandOptions {
  workspaceRoot: string;
  changeName: string;
  request: HistoryRequest;
  /** Where an agent says so on the command line; otherwise the environment
   * decides. */
  actor?: HistoryActor;
  format: "text" | "json";
}

/** Exits 0 when the event is recorded, 1 when it was refused, and 2 when
 * nothing could be read or written. */
export async function recordCommand(options: RecordCommandOptions, deps: HistoryCommandDeps): Promise<number> {
  let recorded: RecordedEvent;
  try {
    recorded = await (deps.record ?? recordHistoryEvent)(options.workspaceRoot, options.changeName, options.request, options.actor !== undefined ? { actor: options.actor } : {});
  } catch (error) {
    if (error instanceof HistoryRefusedError) {
      deps.stderr(`openspec-ui-cli: ${error.message}`);
      return 1;
    }
    deps.stderr(`openspec-ui-cli: could not record it: ${message(error)}`);
    return 2;
  }
  if (options.format === "json") {
    deps.stdout(JSON.stringify(recorded, null, 2));
    return 0;
  }
  deps.stdout(`Recorded: ${describeHistoryEvent(recorded.event)}.`);
  deps.stdout(rolesLine(recorded));
  deps.stdout(`Commit ${recorded.file}${recorded.tasksFile !== undefined ? ` and ${recorded.tasksFile}` : ""} in the change's pull request.`);
  return 0;
}

/** `--reopen 2.3:why`, as the command line gives it. */
export function parseReopen(values: readonly string[]): ReopenedTask[] | string {
  const tasks: ReopenedTask[] = [];
  for (const value of values) {
    const colon = value.indexOf(":");
    if (colon <= 0 || value.slice(colon + 1).trim().length === 0) return `--reopen takes <task>:<why>, as in --reopen 2.3:"the test is missing", not "${value}"`;
    tasks.push({ task: value.slice(0, colon).trim(), why: value.slice(colon + 1).trim() });
  }
  return tasks;
}

export function isSendBackStage(value: string | undefined): value is SendBackStage {
  return value !== undefined && (SEND_BACK_STAGES as readonly string[]).includes(value);
}
