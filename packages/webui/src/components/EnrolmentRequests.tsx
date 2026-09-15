// The keys waiting to be enrolled, where things that wait on a person are
// shown — a-run-is-signed-by-its-person, ADR 0028 "Enrolment is one
// confirmation".
//
// A person is not asked to compare fingerprints. Each request says where the
// run was, on which machine, under which git author and when, and one button
// says the run was theirs.

import type { EnrolmentRequest } from "@openspec-ui/core/browser";

export interface EnrolmentRequestsProps {
  requests: readonly EnrolmentRequest[];
  /** The key whose confirmation is in flight, if any. */
  confirming: string | null;
  /** What the last confirmation of each key reported, by key id. */
  outcomes: Readonly<Record<string, string>>;
  onConfirm: (keyId: string) => void;
}

export function EnrolmentRequests({ requests, confirming, outcomes, onConfirm }: EnrolmentRequestsProps) {
  if (requests.length === 0) return null;
  return (
    <div data-testid="enrolment-requests">
      <p className="openspec-shell-note">
        Runs signed by a key nobody has enrolled. If a run was yours, say so, and its records read as signed by you from then on.
      </p>
      <ul className="openspec-shell-note">
        {requests.map((request) => (
          <li key={request.keyId} data-testid={`enrolment-${request.keyId}`}>
            <strong>{request.label}</strong>
            {` — ${request.workingDirectory}`}
            {`, on ${request.machine ?? "a machine it does not name"}`}
            {request.gitAuthor ? `, git author ${request.gitAuthor}` : ", no git author"}
            {`, last seen ${new Date(request.seenAt).toLocaleString()}`}
            {" "}
            <button className="button primary"
              type="button"
              data-testid={`enrolment-confirm-${request.keyId}`}
              disabled={confirming !== null}
              onClick={() => onConfirm(request.keyId)}
            >
              {confirming === request.keyId ? "Enrolling..." : "It was me"}
            </button>
            {outcomes[request.keyId] ? (
              <div data-testid={`enrolment-outcome-${request.keyId}`}>{outcomes[request.keyId]}</div>
            ) : null}
          </li>
        ))}
      </ul>
    </div>
  );
}
