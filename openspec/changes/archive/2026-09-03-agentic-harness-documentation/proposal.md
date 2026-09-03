## Why

`README.md` does not contain the word "harness". The Agentic Harness is
the largest capability this repository has built — stages, autonomy
levels, review gates, checkpoints, per-stage agents, models, reasoning
effort, spending caps, mechanical checks, chat dispatch, a git stage, ACP
adapters — and a reader arriving at the repository has no document that
says what it is or how to configure it. What documentation exists is
spread across nineteen ADRs and forty change proposals, which record *why
each decision was made* and are the wrong shape for someone who wants to
use the thing.

The gap is not only for newcomers. Two settings were shipped this week
that read as effective and were not, and both were found by questions a
user asked rather than by a check: `effort` on a chat-dispatched stage,
and an entry naming an agent that is never invoked. A page that lays out
every setting beside what honours it is the cheapest instrument this
repository has for finding the next one.

The screenshots make the same point in miniature.
`docs/images/standalone/harness-settings.png` was captured on 2026-08-31;
`HarnessSettingsView.tsx` has changed six times since 2026-08-25,
including three today that added the effort and budget controls, the chat
target, and the mechanical `archive` row. The image in the repository
shows a settings screen that no longer exists. Manual captures rot
silently, and the gallery gives no way to tell a current one from a stale
one.

## What Changes

- New `HARNESS.md` at the repository root: what the harness is, the stage
  sequence, every configuration key with its accepted values, where each
  is set in both user interfaces, and what ACP adapters actually do.
- New `LIMITS.md` at the repository root: the two independent levels of
  spending ceiling, their units and why there is no shared one, when each
  is evaluated, and — stated explicitly — which limits do **not** exist.
- Both documents name, for every agent id, whether it accepts a model, a
  reasoning effort and which values, and a spending cap in which unit.
  This is the part item 3 of the request asks for, and it is the part
  most likely to be got wrong from memory.
- The standalone application's harness screenshots are **generated** by
  the existing Playwright suite in `packages/server/e2e/` and refreshed
  by a documented command, so an interface change and its picture cannot
  drift apart unnoticed. VS Code's are re-captured by hand and labelled
  with the date and version they show, because nothing here can automate
  them — see design.md.
- `README.md`, `packages/server/README.md`, `packages/extension/README.md`
  and `AGENTS.md` link to both documents.

## Capabilities

### New Capabilities

(none — documentation only, no behavior change)

### Modified Capabilities

(none)

## Impact

- New `HARNESS.md`, `LIMITS.md`.
- `docs/images/standalone/harness-*.png` regenerated; a new Playwright
  spec that produces them.
- `README.md`, `AGENTS.md`, both package READMEs: links.
- No `packages/*/src` non-test source changes.

## Explicitly out of scope

- Changing any setting, default or validation rule. If writing a document
  reveals a setting that does not behave as described, that is a defect
  to raise, not to fix here — `acp-agent-capabilities` is the first one
  this proposal's own investigation found.
- Documenting `autonomous` autonomy or the `git` stage as available
  workflows. Both exist, neither has been run end to end by a human here;
  they are described with that stated, not recommended.
- A tutorial or quick-start. These are reference documents; a walkthrough
  is a separate piece of work with a different shape.
