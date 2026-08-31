## Context

See `docs/adr/0001-shared-core-two-delivery-targets.md` item 4 (the
CLI-agent orchestration security model: allowlist, cwd sandbox, audit,
"repository file contents as data, not executable instructions") — this
change operates entirely within that existing boundary; it does not
revise it.

## Goals / Non-Goals

**Goals:**

- Every `plan`/`review`/`implement` run (single-stage or as part of a
  `"chain"`) sends the agent the real content of the change it was asked
  to work on.
- The agent is explicitly told not to wander to a different
  `openspec/changes/<id>/` directory than the one it was given.

**Non-Goals (this change):**

- Not changing `commandInstruction()`'s per-kind instruction text beyond
  what's needed for the "stay within this changeDir" addition.
- Not adding a size limit / truncation strategy for very large
  proposal/design/tasks/spec files — out of scope; revisit only if it
  becomes a real problem (this repository's own change files are all
  well under any adapter's practical prompt-size limits today).
- Not fixing the `webui`/`extension` UI layer at all — the bug is
  entirely upstream of them, inside `execution-core`, so no caller-side
  change is needed or made.

## Decisions

### Fix lives in `security.ts`, not in `webui`

Rejected alternative: have `AiPanel.tsx` (or a new webui helper) fetch
file content over HTTP (`change-editor-client.ts`'s existing endpoint)
and populate `promptContext` before calling `transport.send()`. Rejected
because: (a) it would need to be implemented twice (`standalone-entry.tsx`
and `extension-entry.tsx` both construct commands independently), a
repeat of the exact "not duplicated per host" reasoning from
`agentic-harness-run-menu`'s design.md; (b) `HarnessChainPanel` and
`HarnessChainRunner` construct chain commands too, and would need the
same fix a third time; (c) `security.ts`/`agent-runner.ts` run
server-side or extension-host-side, where real filesystem access is
already available and already trusted (the allowlist/cwd-sandbox checks
already run there) — reading the same files there is strictly simpler
than round-tripping their content through an HTTP/bridge call first.

### `prepareAgentContext` becomes `async`, not "cannot affect what gets run"

This does not weaken the function's existing guarantee — its doc comment
says it "structurally cannot affect what gets run or where," referring to
the allowlist/cwd/executable decision, all of which are made *before*
this function is even called (see `agent-runner.ts`'s ordering: cwd check
→ allowlist check → `prepareAgentContext` → spawn). Becoming `async` to
perform file reads changes nothing about that ordering or guarantee.

### Missing artifact files are silently skipped, not an error

Matches `workbench.ts`'s `discoverChangeArtifacts` precedent exactly (a
change early in its lifecycle may not have a `tasks.md` yet, or no delta
specs at all) — a `plan` run for a brand-new change with only
`proposal.md` should still work, just with less context to embed.

### The "stay within changeDir" instruction is a mitigation, not the fix

Providing real content is what actually gives the agent something
correct to work from; the explicit "do not read/modify other
`openspec/changes/<id>/` directories" line is cheap, additional insurance
against exactly the wandering behavior observed live — belt-and-suspenders,
not a replacement for the content fix.

## Risks / Trade-offs

- **[Risk]** A very large `tasks.md`/multiple delta-spec files could make
  the prompt large enough to matter for some adapter's practical limits.
  → **Mitigation**: none added in this change (see Non-Goals) — no
  evidence yet that this is a real problem for any change in this
  repository; revisit if/when it is.
- **[Trade-off]** This changes the *actual content* every agent receives
  for every future run, including ones already in flight or already
  configured via `stepAgents` — behavior that previously "worked" only by
  virtue of the agent doing its own independent file exploration despite
  an empty prompt will now receive real content instead. This is the
  intended fix, not a regression, but is called out because it changes
  observed agent behavior for every existing `agentic-harness`-driven
  change, not just future ones.

## Migration

None — no data format change, no config change. Purely an internal
prompt-construction fix.
