// `openspec-ui-cli join` and `openspec-ui-cli people` - the people of a
// repository, in git (a-team-works-through-git, ADR 0037).
//
// Presentation only. What a person's file holds, what joining writes and
// what is wrong with a file are core's (`joinTheTeam`, `readPeople`), the
// same calls the editor makes.

import { JoinRefusedError, joinTheTeam, readPeople, type JoinResult, type PeopleReading } from "@openspec-ui/core";

export interface JoinCommandOptions {
  workspaceRoot: string;
  handle: string;
  name: string;
  email?: string;
  format: "text" | "json";
}

export interface TeamCommandDeps {
  stdout: (line: string) => void;
  stderr: (line: string) => void;
  /** Test seams. */
  join?: typeof joinTheTeam;
  read?: (workspaceRoot: string) => Promise<PeopleReading>;
}

function message(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

/** Exits 0 when the file holds this machine's key, 1 when joining was
 * refused, and 2 when nothing could be read or written. */
export async function joinCommand(options: JoinCommandOptions, deps: TeamCommandDeps): Promise<number> {
  let joined: JoinResult;
  try {
    joined = await (deps.join ?? joinTheTeam)(options.workspaceRoot, {
      handle: options.handle,
      name: options.name,
      ...(options.email !== undefined ? { email: options.email } : {}),
    });
  } catch (error) {
    if (error instanceof JoinRefusedError) {
      deps.stderr(`openspec-ui-cli: ${error.message}`);
      return 1;
    }
    deps.stderr(`openspec-ui-cli: could not join: ${message(error)}`);
    return 2;
  }
  if (options.format === "json") {
    deps.stdout(JSON.stringify(joined, null, 2));
    return 0;
  }
  if (joined.outcome === "already") {
    deps.stdout(`${joined.file} already holds this machine's key. Nothing was written.`);
    return 0;
  }
  deps.stdout(joined.outcome === "joined"
    ? `Wrote ${joined.file} for ${joined.person.name}, with this machine's key.`
    : `Added this machine's key to ${joined.file}.`);
  deps.stdout("Commit it in a pull request: once it merges, the team verifies what you sign.");
  return 0;
}

export interface PeopleCommandOptions {
  workspaceRoot: string;
  format: "text" | "json";
}

/** Exits 0 when every file is a person and no key is two people's, 1 when
 * something is wrong, and 2 when nothing could be read. */
export async function peopleCommand(options: PeopleCommandOptions, deps: TeamCommandDeps): Promise<number> {
  let reading: PeopleReading;
  try {
    reading = await (deps.read ?? readPeople)(options.workspaceRoot);
  } catch (error) {
    deps.stderr(`openspec-ui-cli: could not read the people: ${message(error)}`);
    return 2;
  }
  if (options.format === "json") {
    deps.stdout(JSON.stringify(reading, null, 2));
    return reading.problems.length === 0 ? 0 : 1;
  }
  if (reading.people.length === 0 && reading.problems.length === 0) {
    deps.stdout("Nobody has joined yet. Join with: openspec-ui-cli join --handle <handle> --name <text>");
    return 0;
  }
  for (const person of reading.people) {
    const current = person.keys.filter((key) => key.retiredAt === undefined).length;
    const retired = person.keys.length - current;
    deps.stdout(`${person.handle}  ${person.name}  ${current} key${current === 1 ? "" : "s"}${retired > 0 ? `, ${retired} retired` : ""}`);
  }
  for (const problem of reading.problems) deps.stderr(`${problem.file}: ${problem.problem}`);
  return reading.problems.length === 0 ? 0 : 1;
}
