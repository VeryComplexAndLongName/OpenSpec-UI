## Context

Read from `harness-config.ts` on 2026-09-02:

- `assertValidHarnessConfigInput` checks the value of each key it knows
  about, and never enumerates the keys present. There is no unknown-key
  branch at the top level.
- `assertValidStepAgents` **does** have one, added by
  `harness-config-strictness`, but only inside a stage entry and inside
  `budget`.
- `migrateLegacyDispatchInConfig` reads `rootRecord.stepAgents` and
  returns the input untouched when it is absent — so a file with no
  `stepAgents` passes through every stage of validation without being
  looked at.
- `readGlobalHarnessConfig` then reads `input.stepAgents ?? {}` and the
  other four keys with defaults, so a file made entirely of unrecognized
  keys resolves to the default configuration.

## Goals / Non-Goals

**Goals:**

- A harness file that cannot have the effect its author intended fails
  to load, rather than resolving to something else.
- The error names the unrecognized key and the accepted set, so the fix
  is one edit.

**Non-Goals:**

- Deepening validation inside the five keys that are not `stepAgents`.
- Inferring what a misplaced key meant.

## Decisions

### Refuse, at the same point the other refusals happen

The check goes in `assertValidHarnessConfigInput`, beside the existing
per-key checks, so a bad file fails when the configuration resolves — the
same moment a bad `effort` or a mismatched `budget` field fails today.

**Rejected alternative**: warn and continue, as the legacy-dispatch
migration does. Rejected — the migration warns about a file that still
has a defined meaning, and maps it to that meaning. An unrecognized key
has no meaning to map to, so continuing means running with a
configuration nobody wrote. This repository has removed four settings
this week for behaving that way, and `harness-config-strictness`
design.md already rejected warning at the level below, on this
repository's own evidence: `npm run lint` was expected-red for days and a
real error passed unread.

### Both files, one rule

The global file and a per-change `harness.json` are read by the same
validator and are equally hand-written. A rule that applied to one would
have to be explained, and the explanation would be that nobody got round
to the other.

**Rejected alternative**: per-change only, since that is where the found
instance was. Rejected — the global file is the one every workspace
copies from a documented example, so a typo there is more likely to be
propagated, not less.

### No migration, and no guessing

Unlike `harness-config-strictness`, this change has nothing to migrate.
`dispatch` was a key that used to be valid; an unrecognized key never
was. A file that trips this check was already not doing what its author
wrote, so failing it takes nothing away.

**Rejected alternative**: rewrite a top-level `apply`/`review`/`propose`
into `stepAgents`, since that is the mistake actually observed. Rejected
— it is a guess about intent, and a configuration that quietly does
something its author did not write is the failure this change exists to
remove, not a helpful recovery from it. The error message can *name* the
likely fix without performing it.

## Risks / Trade-offs

- **[Risk]** A workspace carrying a harmless extra top-level key — a
  comment field, a leftover from an older shape — stops loading. →
  **Mitigation**: the error names the key and the accepted set, so the
  fix is one edit and obvious. The same trade-off was accepted one level
  down, for the same reason: the alternative is that a misplaced real
  setting stays invisible, which is the more expensive failure.
- **[Trade-off]** JSON configuration commonly ignores unknown keys, so
  this is stricter than a reader may expect. Accepted deliberately, and
  it is the second half of a decision already taken — the surprising
  state is the current one, where a key is rejected inside a stage entry
  and ignored one line above it.

## Open Questions

- Whether the error should suggest `stepAgents` when the unrecognized key
  is a stage name (`propose`, `review`, `apply`, `verify`, `archive`,
  `git`). It is the observed mistake and the suggestion costs nothing;
  the argument against is that a suggestion in an error message is a
  guess wearing authority. Leaning toward naming it as a possibility
  ("did you mean `stepAgents.apply`?") rather than asserting it.
