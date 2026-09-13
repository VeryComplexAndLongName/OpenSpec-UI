# Design

This change implements ADR 0028's decisions on signatures for the status
record: "Signatures, from the start", "A key belongs to a person, on a
machine", "Ed25519 from the runtime", "Verification is three-valued",
"The bytes are what is signed" and "Enrolment is one confirmation". ADR
0029 depends on it for any control offered on a run that another process
started.

## Context

- **The status record today.** A run's record is a JSON document written to
  `<worktreeRoot>/<repo>/.agent-status/<instanceId>.json` through a
  temporary name and a rename. `readAgentStatusRecord` copies its fields and
  never checks `version`. A sweep removes stale records and keeps malformed
  ones.
- **Verifying Ed25519 needs nothing new.** `node:crypto` has
  `generateKeyPairSync("ed25519")`, `sign(null, bytes, key)` and
  `verify(null, bytes, key, signature)`. ADR 0028 measured them.
- **Where the inbox stands.** It is `collectHumanOnlyInbox` in core, shown
  by the standalone inbox and by the editor's Human-Only Inbox tree.
  `HumanOnlyInbox` already carries additional lists beside `items`.

## Decisions

### The key lives in the person's configuration directory, one per machine

The key is created at `<home>/.openspec-ui/identity/`:

- `ed25519.pem` holds the private key, with mode `0o600` where the platform
  honours it;
- `ed25519.pub.pem` holds the public key.

Both files are written through a temporary name and a rename, so two runs
that start together end up with one key. `keyId` is the first 32 hex
characters of the SHA-256 of the public key's DER encoding.

Rejected:

- **A key per run, or per working directory.** ADR 0028 rejects both.
- **A passphrase.** An unattended run has nobody to type one, and ADR 0028
  says the key has to be usable without a person. The file's permissions
  protect it.
- **The person's SSH key.** ADR 0028 rejects it: revoking that key would
  take away the person's repository access too.

### The record is an envelope around its own bytes

The record has two layers:

- the **payload** is the version 1 document, exactly as it is written
  today, plus two claimed fields, `machine` and `gitAuthor`;
- the **envelope** is `{ version: 2, keyId, publicKey, signature, payload }`.

`payload` is the base64 of the payload's bytes, and `signature` is the
Ed25519 signature over those same bytes.

A reader takes these steps in order, and parses the payload only after the
signature verifies:

1. Parse the envelope.
2. Check that `keyId` matches `publicKey`.
3. Verify `signature` over the decoded bytes.
4. Parse the payload.

Rejected:

- **A signature field inside the JSON document.** It would require a
  canonical serialisation, which is exactly the case ADR 0028 warns
  against: the signature would cover something other than what is
  displayed.
- **A signature file beside the record.** Two files cannot be replaced
  together, so a reader could pair a new record with an old signature and
  report it as not checking out.

### Three states, stated exactly

| State | When |
| --- | --- |
| verified | the signature is valid, and the roster holds `keyId` with the same public key |
| unverified | the record is an unsigned version 1 document, or the key is valid but not in the roster |
| does not check out | `keyId` does not match the key, the signature fails, or the roster holds that `keyId` with a different key |

For each state:

- **Verified:** the report carries the roster's `label`, and the git author
  given at enrolment. It is described as `signed by <label>, verified`.
- **Unverified:** the report is described as "not verified".
- **Does not check out:** the report carries the file name, and nothing from
  the payload. The sweep keeps the file, as it keeps a malformed record.

The instance a record names is always described as its claim.

Rejected:

- **Treating a record that does not check out as unverified.** ADR 0028
  says the third state is a finding, not a quieter form of the second.

### The roster is a file per key, beside the status directory

The roster is `<worktreeRoot>/<repo>/.agent-roster/<keyId>.json`, holding
`{ keyId, publicKey, label, gitAuthor?, machine, confirmedAt }`. It is
written by whoever confirms the enrolment, through a temporary name and a
rename. A file whose name does not match its `keyId`, or whose `keyId` does
not match its key, is reported as malformed and never trusted.

Rejected:

- **One roster file.** ADR 0028 rules one writer per fact, with no lock.
- **Signing the roster.** The first key would need a key to enrol it. The
  directory's permissions are the trust boundary ADR 0028 names for today,
  and its revision triggers say when to re-examine that.

### Enrolment is a request waiting on a person

Every key that signs a live record without being in the roster produces one
request. The request carries the directory's label, the working directory,
the machine, the git author, and when the key was last seen.

`HumanOnlyInbox` gains `enrolments`. Each host shows them beside the items:

- the standalone inbox, with `It was me`;
- the editor's tree, with an inline `It was me`;
- `openspec-ui-cli enrol`, which lists requests, and
  `openspec-ui-cli enrol <keyId>`, which confirms one.

Confirming writes the roster file. The label defaults to the git author,
and can be edited.

Rejected:

- **A fingerprint comparison.** ADR 0028 says a person confirms that they
  started the run, and is not asked to compare fingerprints.

### Reporting stays best-effort

A writer that cannot load a key writes the version 1 document unsigned, and
the run continues. The requirement "Reporting what a run is doing never
stops the run" still holds.

## Protocol

No command or event changes. The status record's file format gains version
2, and readers from before this change cannot read it, as the risks below
note.

## Non-Goals

- Signed requests to stop, which belong to
  `a-run-elsewhere-can-be-asked-to-stop`.
- Reporting and retiring dormant keys.
- The analysis report on message frequency and origin.
- Signing the audit log or the lease.

## Risks / Trade-offs

- **An older reader sees a new record as malformed.** A host or CLI from
  before this change reads a version 2 envelope as malformed, because the
  required fields are inside the payload. The products are released
  together, and until each is updated the old reader keeps the record and
  reports it, and removes nothing.
- **Anyone who can write the directories can add a roster file.** On one
  machine and one account, that is the person themselves. ADR 0028 accepts
  this for today and records when to revisit it.
- **The private key sits unencrypted on disk.** Its protection is the
  file's permissions, as with any unattended credential. Losing the machine
  revokes one key, by removing its roster file.
- **A copied home directory copies the key.** Two machines then share one
  key, and their records read as one person's machine. The roster entry
  names the machine where the key was enrolled.
