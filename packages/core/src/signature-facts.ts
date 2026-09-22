// What a signature on a run's record shows, and the words it is said in —
// ADR 0028, "Verification is three-valued" and "Enrolment is one
// confirmation".
//
// A leaf with no Node imports, so the browser can have it: the reading and
// the roster live in `signed-envelope.ts` and `agent-roster.ts`, which use
// `node:crypto` and the filesystem.

/** How far a record's signature shows whose it is. Three values, not two: a
 * record that does not check out is a finding, not a quieter "unverified". */
export type RecordSignature = "verified" | "unverified" | "does-not-check-out";

/** The person a verified record is signed by, as the roster names them. The
 * label and the git author were given at enrolment; neither is proven by the
 * signature, which proves only that an enrolled key signed. */
export interface EnrolledPerson {
  keyId: string;
  label: string;
  gitAuthor?: string;
  /** The person's handle, where the key is in their file in the repository
   * (`openspec/people/`, ADR 0037) rather than only in this machine's
   * roster. */
  handle?: string;
}

/** A key that signs a live record and is not in the roster, with what a
 * person needs to decide "was this me" at a glance. */
export interface EnrolmentRequest {
  keyId: string;
  /** Base64 of the key's SPKI DER encoding, so confirming needs nothing else. */
  publicKey: string;
  /** The name of the run's working directory. */
  label: string;
  workingDirectory: string;
  /** The machine and the git author the record claims. */
  machine: string | null;
  gitAuthor: string | null;
  /** When the key last signed a record, as that record says. */
  seenAt: string;
}

/** One record's signature, in the words every surface uses. */
export function describeSignature(signature: RecordSignature, person?: EnrolledPerson): string {
  if (signature === "does-not-check-out") return "its signature does not check out";
  if (signature === "verified" && person !== undefined) return `signed by ${person.label}, verified`;
  return "not verified";
}

/** One enrolment request, in the words every surface uses. */
export function describeEnrolmentRequest(request: EnrolmentRequest): string {
  const machine = request.machine ? `on ${request.machine}` : "on a machine it does not name";
  const author = request.gitAuthor ? `git author ${request.gitAuthor}` : "no git author";
  return `${request.label} — ${request.workingDirectory}, ${machine}, ${author}, last seen ${request.seenAt}`;
}
