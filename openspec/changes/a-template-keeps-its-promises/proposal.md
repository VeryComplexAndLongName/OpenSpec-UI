# A template keeps the promises it makes

## Why

The Overnight template says "No checkpoints between stages" and does not
set `checkpoints`. So a change configured from it still pauses for
confirmation between every stage — the one thing an unattended overnight
run must not do.

Found by the owner on 2026-09-08, applying each template in a disposable
workspace and reading the file that came out. Careful and Thrifty were
correct. Overnight saved its `timeout`, `budget` and `maxStageAttempts`
and kept `checkpoints.requireConfirmationBetweenSteps: true`.

No test could have caught it. The existing guard asserts every template
produces no findings from `findHarnessConfigLimits`, which is about
ceilings that cannot act, and nothing at all compares a template's
sentences against its configuration. The sentences are the interface —
they are what a person reads before applying one — so a sentence that is
not true is the same defect as a wrong ceiling, arriving through a door
nothing was watching.

## Capabilities

### Modified

- The Overnight template sets the absence of checkpoints it describes.
- A template's stated behaviour is checked against its configuration.

## Out of scope

Checking every sentence against every field. The claims a template makes
are prose and most cannot be mechanically read. This checks the claims
that name a specific setting, which is the class the defect came from.
