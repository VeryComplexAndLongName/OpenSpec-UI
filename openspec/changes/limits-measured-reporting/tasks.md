The document already tells the truth about the mechanism. What it does
not do is separate what has been seen from what is expected, and that is
the difference between a reader knowing their ceiling works and assuming
it does.

Do not overstate the evidence either: one completed run on one agent is
one observation, not a guarantee for every version of that CLI.

## 1. Say what was measured

- [x] 1.1 `LIMITS.md`: mark each agent's row as **measured** or
  **expected**. Only `copilot-cli-acp` is measured today.
- [x] 1.2 For `copilot-cli-acp`, state the consequence rather than the
  raw fact: it reports tokens and no cost, so `budget.maxCostUsd` cannot
  act on it and `budget.maxTokens` can. A reader setting a ceiling needs
  the consequence.
- [x] 1.3 Date the observation and name its source
  (`.openspec-ui/audit.jsonl`), so a later reader can tell how old it is
  and check it again rather than trusting it indefinitely.
- [x] 1.4 Say that one observation is one observation: a different
  version of the same CLI may send something else, and the ACP usage
  field is marked `UNSTABLE` in the SDK.

## 2. Mark what is not measured

- [x] 2.1 `claude-cli-acp`'s row says its reporting is expected from
  `claude`'s documented stream format and its unit tests, and has not
  been observed in a run. Its one run since the feature landed failed.
- [x] 2.2 Do not weaken the row to "unknown". The format is documented
  and the parsing is tested; the honest word is "expected", and the
  distinction from "measured" is the point.

## 3. Say that a failed run records nothing

- [x] 3.1 State that a run that fails before its agent reports
  contributes nothing to a ceiling — three of the four runs since the
  feature landed did exactly that. A reader may reasonably expect a
  failed run's spend to still count, and it does not.

## 4. Verification

- [x] 4.1 `openspec change validate --strict limits-measured-reporting`.
- [x] 4.2 Re-read the audit log and confirm the table matches it, rather
  than matching this proposal — the log may have gained runs since this
  was written, and a document describing evidence must match the
  evidence at the time it ships.
- [x] 4.3 `npm run lint` for the English policy. No code changes, so
  typecheck and tests are a regression check only.
- [x] 4.4 No changeset: documentation, nothing published changes.
