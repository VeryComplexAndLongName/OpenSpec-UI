# The Run dialog advises, rather than claiming to

## Why

The Run entry was built to show what it read and recommend what suits the
change. What it does is offer three buttons.

Four things are wrong, and they were all shipped by the change that
claimed them:

- **The standalone dialog never advises.** It calls `buildRunPlan`
  without a recommendation input, and the reason recorded for that —
  "this shell can read neither the task list nor the audit log" — is not
  true of the task list. `/api/change-timeline` already returns every
  task with its `done` state.
- **The editor's advice is hidden.** It goes into a quick-pick's
  `placeHolder`, a grey line that truncates. Present in the object,
  absent from the reader.
- **No template can be applied.** The recommendation names one and offers
  no way to say yes. A recommendation that cannot be acted on is a
  remark.
- **A clean configuration says nothing.** The findings list renders only
  when something is wrong, so "every ceiling can act" and "nothing was
  checked" look identical — the distinction this project has drawn four
  times, missed in the surface built to make it.

Reported by the owner on 2026-09-08, opening the dialog and finding a
path picker.

## Capabilities

### Modified

- The Run dialog carries a recommendation in both hosts, shows it where
  it can be read, and lets the configuration it names be applied.
- A configuration with nothing wrong says so.

## Out of scope

Serving the audit history to the standalone shell. The recommendation
degrades by design where there is no history — it says there is none —
and a new REST route plus its bridge is a larger argument than this
change needs. The task count is available today; that is what this uses.
