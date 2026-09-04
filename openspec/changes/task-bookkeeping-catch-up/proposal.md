## Why

Four shipped changes record work as not done.

`tasks.md` is what decides whether a change may be archived. Right now it
lies about four of them, in the same direction and for the same reason:

| Change | Recorded | Actually |
| --- | --- | --- |
| `run-with-harness-prefills-the-run` | **0 of 16 done** | Shipped in #202; `initialCommandKind` is in `AiPanel.tsx`, its changeset released in webui 1.25.0 |
| `usage-from-acp` | 5.2, 5.3 open | Checks ran; changeset released in core 0.50.0 |
| `event-guard-covers-every-kind` | 4.2, 4.3 open | Checks ran; changeset released as a core patch in 0.50.0 |
| `usage-visible-while-running` | 5.2, 5.3 open | Checks ran; changeset released |

The cause is a sequencing habit, not four separate slips. Tasks were
ticked, the files were copied into a worktree and committed, and only
*then* were the final checks run and `npx changeset` invoked — after the
commit that would have recorded them. The same order produced the same
omission four times, and it always struck the last two items of a list:
"run the checks" and "add a changeset".

`run-with-harness-prefills-the-run` is the worst case, and a different
one: nothing was ticked at all, so a complete change reads as untouched.

This is worth correcting rather than leaving, because the next person to
read these files — or the archive step — would conclude that shipped work
is outstanding, and either redo it or refuse to archive it.

## What Changes

- The four `tasks.md` files are corrected to record what is in `main`.
- Only items verified against the repository are ticked. Every
  **human-only** item stays open, including the two that are partially
  observed but not fully demonstrated.
- `openspec/README.md`: the order that avoids this — tick the
  verification items after they pass, not before the commit that carries
  them.

## Capabilities

### Modified Capabilities

- `openspec-workbench`: a change's task record states what is done, and a
  verification item is recorded only once it has been carried out.

## Impact

- Four `tasks.md` files and `openspec/README.md`. No source changes, no
  behaviour changes, no changeset.

## Explicitly out of scope

- **Ticking anything not verified.** Each claim was checked against
  `main` — the code, the tests, the CHANGELOG entry for the released
  changeset — rather than against a memory of having done it. Ticking in
  bulk would repeat the original error in the opposite direction and
  leave a record that is still wrong.
- **Archiving these changes.** Their human-only verification is still
  outstanding, which is exactly what the corrected files now say.
- **Auditing every other change's bookkeeping.** Ten more active changes
  carry open items; those are real, and unrelated to this defect.
