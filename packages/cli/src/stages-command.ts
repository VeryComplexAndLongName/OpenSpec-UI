// `openspec-ui-cli stages [<change>]` - where each change is, and how long
// it spent in each stage (a-change-knows-its-stage, ADR 0037).
//
// Presentation only. The facts, the stages and the visits are core's
// (`readChangeStages`, `readChangeStage`), the same reading the board uses.

import {
  describeDuration,
  describeStage,
  describeVisit,
  readChangeStage,
  readChangeStages,
  readChangeStandings,
  type ChangeStageReading,
  type ChangeStanding,
} from "@openspec-ui/core";

export interface StagesCommandDeps {
  stdout: (line: string) => void;
  stderr: (line: string) => void;
  /** Test seams. */
  standings?: (workspaceRoot: string) => Promise<readonly ChangeStanding[]>;
  readAll?: typeof readChangeStages;
  readOne?: typeof readChangeStage;
  now?: () => Date;
}

function message(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

function roles(reading: ChangeStageReading): string {
  return `Owner ${reading.roles.owner ?? "nobody"}, Implementer ${reading.roles.implementer ?? "nobody"}`;
}

/** Exits 0 once it has said where each change is, and 2 where it could not
 * read the changes. A source that could not be read - the forge, the audit
 * log - leaves out the facts it would have given, and nothing else. */
export async function stagesCommand(
  options: { workspaceRoot: string; changeName?: string; format: "text" | "json" },
  deps: StagesCommandDeps,
): Promise<number> {
  const now = (deps.now ?? (() => new Date()))();
  const standings = await (deps.standings ?? (async (root: string) => (await readChangeStandings(root)).standings))(options.workspaceRoot).catch(() => [] as ChangeStanding[]);
  let readings: ChangeStageReading[];
  try {
    if (options.changeName !== undefined) {
      const standing = standings.find((one) => one.changeName === options.changeName);
      readings = [await (deps.readOne ?? readChangeStage)(options.workspaceRoot, options.changeName, {
        ...(standing !== undefined ? { standing } : {}),
        now: () => now,
      })];
    } else {
      readings = await (deps.readAll ?? readChangeStages)(options.workspaceRoot, { standings, now: () => now });
    }
  } catch (error) {
    deps.stderr(`openspec-ui-cli: could not read the stages: ${message(error)}`);
    return 2;
  }

  if (options.format === "json") {
    deps.stdout(JSON.stringify(options.changeName !== undefined ? readings[0] : readings, null, 2));
    return 0;
  }
  if (options.changeName === undefined) {
    if (readings.length === 0) deps.stdout("No active change.");
    for (const reading of readings) {
      const since = reading.since === undefined ? "" : `, for ${describeDuration(now.getTime() - Date.parse(reading.since))}`;
      deps.stdout(`${reading.changeName}  ${describeStage(reading.stage)}${since}  (${roles(reading)})`);
    }
    return 0;
  }
  const reading = readings[0] as ChangeStageReading;
  deps.stdout(`${reading.changeName}: ${describeStage(reading.stage)}. ${roles(reading)}.`);
  if (reading.visits.length === 0) deps.stdout("Nothing dates its stages yet: it has no commit, run or pull request.");
  for (const visit of reading.visits) deps.stdout(`  ${describeVisit(visit, now)}`);
  if (reading.totals.length > 0) {
    deps.stdout("Time in each stage:");
    for (const total of reading.totals) {
      deps.stdout(`  ${describeStage(total.stage)}: ${describeDuration(total.ms)}${total.visits > 1 ? `, over ${total.visits} visits` : ""}`);
    }
  }
  return 0;
}
