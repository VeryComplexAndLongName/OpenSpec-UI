## Context

See `openspec/changes/agent-prompt-context/` (the change this is a direct
follow-up to) and `packages/core/src/agents/copilot.ts`'s existing header
comment (`copilot -p` has no stdin path — a live-smoke-test-confirmed CLI
constraint, not a design choice this product made).

## Goals / Non-Goals

**Goals:**

- A `copilot-cli` `plan`/`review`/`implement` run never fails outright
  just because the change's combined artifact content is large — it
  degrades to a shorter, path-pointing prompt instead.
- The fallback prompt is still specific and forceful enough to avoid
  reintroducing the original wandering behavior `agent-prompt-context`
  fixed (naming the exact `changeDir` and files, plus the "stay within
  this directory" constraint).

**Non-Goals (this change):**

- Not changing how `claude-cli`/`codex-cli`/`gemini-cli` build their
  prompts — stdin has no comparable limit for any of them.
- Not fixing the allowlist/actual-invocation argument-count mismatch
  noted in proposal.md — see "Also found, not in scope" below.
- Not adding a size limit/truncation strategy to `prepareAgentContext`
  itself (`agent-prompt-context`'s own design.md already scoped that out)
  — the fix here is local to `copilot-cli`'s own delivery mechanism, not
  a general prompt-size policy.

## Decisions

### Threshold is on the constructed prompt, checked in `copilot.ts` itself

Rejected alternative: have `prepareAgentContext` (or a new shared helper)
return both a "full" and a "short" variant, letting every adapter choose.
Rejected because no other adapter has this constraint — stdin's prompt
size does not meaningfully affect any of them, so a shared two-variant
contract would be unused complexity for three of the four CLI adapters,
duplicating exactly the kind of per-adapter accommodation `copilot.ts`
already has for "no stdin, argv-only, and 3 args not 2" — see the existing
header comment there.

### Fallback prompt tells the agent to read the files itself, not truncates them

Rejected alternative: truncate the embedded content to fit under the
limit. Rejected because a truncated `tasks.md` (arbitrarily cut off
mid-checklist) is actively misleading — an agent reading a truncated
checklist could believe fewer tasks exist than actually do. Since
`copilot-cli` already runs with `--allow-all-tools` (it has real file
tools), telling it exactly where to look and to read the *complete* files
itself is strictly better than feeding it a corrupted partial version of
the same content.

### Threshold: 6000 characters on the prompt argument itself

The observed real failure was a ~9.5KB prompt exceeding `cmd.exe`'s
~8191-character total command-line budget, which also has to fit
`copilot`, `-p`, `--allow-all-tools`, the `cmd.exe /d /s /c` wrapper, and
quoting overhead alongside the prompt text. 6000 leaves several hundred
characters of margin for that overhead without being so conservative that
small-to-medium changes (most of them, in practice) still degrade
unnecessarily.

### Also found, not in scope: allowlist checks a different arg shape than what runs

`buildDefaultAllowlist()`'s `copilot-cli` rule matches
`buildInvocation()`'s static `["-p", "--allow-all-tools"]`, but
`execute()` actually spawns `["-p", <prompt>, "--allow-all-tools"]` — the
allowlist never actually validates the 3-argument shape that runs. Not an
exploitable gap (the inserted argument is always prompt text — a single
positional value, not something `copilot` re-parses as a flag — so
content injected there still cannot select a different executable, flag,
or cwd, preserving the actual security property the allowlist exists to
enforce), but a real documentation/consistency gap between what the
allowlist rule claims to check and what is truly spawned. Left as a noted
follow-up rather than fixed here, to keep this change scoped to the
actual reported failure.

## Risks / Trade-offs

- **[Trade-off]** A large change now gets a *weaker* guarantee for
  `copilot-cli` specifically (the fix `agent-prompt-context` made — "the
  agent definitely has the real content, not just a path it must
  correctly interpret" — reverts to "the agent is told exactly where to
  look and should read it," relying on `copilot-cli`'s own tool use
  again, though far more explicitly constrained than the original empty
  prompt that caused the wandering behavior in the first place).
  Accepted: the alternative is an outright failure for every
  large-enough change, which is strictly worse.

## Migration

None — additive fallback behavior only; unaffected for any prompt already
under the threshold (the common case).
