// `openspec-ui-cli enrol` — the keys waiting to be enrolled, and confirming
// one (a-run-is-signed-by-its-person, ADR 0028 "Enrolment is one
// confirmation").
//
// Presentation only. Which requests exist and what a confirmation writes are
// core's (`readEnrolmentRequests`, `confirmEnrolmentFor`), the same calls the
// standalone inbox and the editor make.

import {
  EnrolmentRefusedError,
  confirmEnrolmentFor,
  describeEnrolmentRequest,
  readEnrolmentRequests,
  type AgentRosterEntry,
  type EnrolmentReading,
} from "@openspec-ui/core";

export interface EnrolOptions {
  workspaceRoot: string;
  /** Absent lists the requests; present confirms the one it names. */
  keyId?: string;
  /** The name the person is to be known by. */
  label?: string;
  format: "text" | "json";
}

export interface EnrolDeps {
  stdout: (line: string) => void;
  stderr: (line: string) => void;
  /** Test seams. */
  read?: (workspaceRoot: string) => Promise<EnrolmentReading>;
  confirm?: (workspaceRoot: string, keyId: string, options: { label?: string }) => Promise<AgentRosterEntry>;
}

function message(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

/** Listing exits 0 whether or not anything waits. Confirming exits 0 when the
 * key is enrolled, 1 when the confirmation is refused, and 2 when nothing
 * could be read or written. */
export async function enrolCommand(options: EnrolOptions, deps: EnrolDeps): Promise<number> {
  if (options.keyId === undefined) {
    let reading: EnrolmentReading;
    try {
      reading = await (deps.read ?? ((root: string) => readEnrolmentRequests(root)))(options.workspaceRoot);
    } catch (error) {
      deps.stderr(`openspec-ui-cli: could not read the keys waiting to be enrolled: ${message(error)}`);
      return 2;
    }
    if (options.format === "json") {
      deps.stdout(JSON.stringify(reading.requests, null, 2));
      return 0;
    }
    if (reading.requests.length === 0) {
      deps.stdout("No key is waiting to be enrolled.");
      return 0;
    }
    for (const request of reading.requests) {
      deps.stdout(request.keyId);
      deps.stdout(`    ${describeEnrolmentRequest(request)}`);
    }
    deps.stdout("");
    deps.stdout("If a run was yours, confirm its key: openspec-ui-cli enrol <keyId> [--label <text>]");
    return 0;
  }

  let entry: AgentRosterEntry;
  try {
    entry = await (deps.confirm ?? confirmEnrolmentFor)(
      options.workspaceRoot,
      options.keyId,
      options.label !== undefined ? { label: options.label } : {},
    );
  } catch (error) {
    if (error instanceof EnrolmentRefusedError) {
      deps.stderr(`openspec-ui-cli: ${error.message}`);
      return 1;
    }
    deps.stderr(`openspec-ui-cli: could not enrol ${options.keyId}: ${message(error)}`);
    return 2;
  }
  if (options.format === "json") {
    deps.stdout(JSON.stringify(entry, null, 2));
    return 0;
  }
  deps.stdout(`Enrolled ${entry.keyId} as ${entry.label}. Its runs now read as signed by ${entry.label}, verified.`);
  return 0;
}
