# A run is signed by its person

## Why

ADR 0028 decides "Signatures, from the start": a key belongs to a person on
a machine, a person's agents sign with it, verification has three values,
and enrolment is a single confirmation. It implements the decision in two
changes. The first, `an-agent-says-what-it-is-doing`, shipped the status
record unsigned. The second, asking a run to stop, cannot ship without
signatures, because "a stop is acted on, and a message that is acted on is
worth forging" (that change's design).

ADR 0029 depends on the same fact. A card offers Stop for a run that
another process started only once a signature shows the run belongs to the
person asking. The card has to say whose a run is, and today nothing can
say it:

- **A status record claims everything and proves nothing.** It carries an
  activity, a change and a working directory. Any process that can write
  the directory can write a record, and a reader has no way to tell one
  writer from another.
- **The only identity on offer is a git author.** A lease records
  `git config user.email`. ADR 0028 calls that "claimed", and keeps it
  apart from what a signature establishes.
- **No key exists.** There is no key, no roster, and no enrolment.

## Capabilities

### New

- **A key per person, per machine.** An Ed25519 key, made by the runtime on
  first need, is kept in the person's own configuration directory. It has
  no passphrase, because an unattended run must be able to sign.
- **A signed status record.** The record's exact bytes are signed, and they
  are read only after the signature verifies.
- **Verification in three states:** verified, unverified, or does not check
  out. Each is stated exactly: a verified record is signed by an enrolled
  person, and the instance it names is still only its claim.
- **A roster** beside the status directory, with one file per enrolled key.
- **An enrolment request** for a key that signs a live record but is not
  enrolled. The request appears where things that wait on a person already
  appear, and carries what a person needs to decide at a glance: the
  directory's label, its path, the machine, the git author, and the time.
  Confirming it is one action.

### Modified

- The survey's runs, `openspec-ui-cli status`, and the run lines in the
  Pipeline say whose a run is, as far as its signature shows.
- The Human-Only Inbox, in both hosts, lists enrolment requests beside its
  items.
- A record that does not check out is kept by the sweep and reported, and is
  never read.

## Impact

- `packages/core`: new `machine-key.ts`, `signed-envelope.ts` and
  `agent-roster.ts`; `agent-status.ts` (writing and reading the envelope);
  `worktree-survey.ts` and its facts; the inbox and its view types.
- `packages/cli`: `status-command.ts`, and a new `enrol` command.
- `packages/server`: an enrolment route and the inbox payload.
- `packages/extension`: inbox rows for enrolment requests, and
  `openspec-ui.confirmEnrolment`.
- `packages/webui`: the inbox's enrolment requests, and the run lines.
- No dependency is added. The runtime's `crypto` signs and verifies Ed25519
  (ADR 0028).

## Out of scope

- Asking a run to stop. That belongs to
  `a-run-elsewhere-can-be-asked-to-stop`.
- Reporting a dormant key, retiring a key, and the analysis report ADR 0028
  describes. Each can follow once keys exist in use.
- Signing anything other than the status record.
