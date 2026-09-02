## Context

`detectAvailableAgents` runs every agent's probe concurrently
(`Promise.all`, `agent-detection.ts:74`), and its own doc comment states
that "total wall time is bounded by the slowest single check ... not the
sum". That property is what makes raising the per-probe timeout cheap:
the worst case grows from ~3 s to ~10 s once, not per agent.

## Goals / Non-Goals

**Goals:**

- An installed CLI is reported as detected even on a loaded Windows
  machine.
- The chosen number is traceable to the measurements that justify it.

**Non-Goals (this change):**

- Making detection faster (caching results, probing lazily, or replacing
  `--version` with a `PATH` lookup). Those change what detection *is* and
  deserve their own change; this one only stops a correct answer from
  being cut short.
- Changing `detectLocalLlm`'s `HTTP_TIMEOUT_MS`. An HTTP endpoint that
  does not answer in 1.5 s is a different situation from a process that
  is slow to start, and nothing has been reported against it.
- Surfacing "probe timed out" distinctly from "not installed" in the UI.
  Worth doing, but it is a protocol and UI change, not a constant.

## Decisions

### Raise the timeout to 10 s rather than to just above the measurement

Measured worst case was 6.51 s. 10 s leaves headroom for a colder start
than any measured here (first run after boot, antivirus scanning a
freshly updated binary, a machine busier than the one measured) without
being unbounded.

**Rejected alternative**: set it to ~7 s, just above the observed
maximum. Rejected — the measurements were taken on one machine over three
runs; treating that maximum as the ceiling would make the same class of
false negative recur on slower hardware, and the cost of the extra
headroom is paid only when an agent is genuinely absent.

**Rejected alternative**: remove the timeout entirely and wait for the
process. Rejected — a hung probe would hang the picker's annotation
indefinitely, with no signal to the user. A bounded wrong answer is
recoverable; an unbounded wait is not.

### Keep reporting a timeout as "not detected"

A probe that exceeds even the raised budget still resolves `false`. The
alternative — a third state — is listed under Non-Goals: it changes the
detection result type, the transport payload, and the picker's
rendering, which is disproportionate to a constant that is currently
simply too small.

## Risks / Trade-offs

- **[Trade-off]** When an agent is genuinely not installed, its probe now
  occupies up to 10 s instead of 3 s before the picker can annotate it.
  Accepted: `cross-spawn` fails fast with an `error` event for a missing
  executable (`agent-detection.ts:44`), so a truly absent CLI resolves
  immediately and never reaches the timeout — the timeout is only paid by
  an executable that exists and is slow, which is exactly the case this
  change exists to serve.
- **[Risk]** The number is a guess beyond the measured range, and could
  still be too small on much slower hardware. → **Mitigation**: the
  measurements and the reasoning are recorded in the code comment, so a
  future report has something to adjust against rather than a bare
  constant.

## Migration Plan

No migration. One constant; no persisted state, no protocol change.
