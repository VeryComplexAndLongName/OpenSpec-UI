## Why

Reported by a user on 2026-09-24, with a screenshot of Harness settings:
claude-cli on every stage and a $5 budget gave

- "claude-cli" reports no usage at all, so no spending ceiling can act on
  "propose" however large the spend.
- ... on "review" ...
- ... on "apply" ...
- ... on "verify" ...

and the same four again in the run dialog. "A lot of repetitions when it
all is down to claude-cli not reporting spend." Four lines differing in
one word read as four problems; there is one.

## What Changes

- `groupHarnessFindings` in core: findings of one kind about one agent,
  whose words differ only in the stage they name, become one sentence
  naming every stage, in the order the stages run: "... can act on
  "propose", "review", "apply" and "verify" however large the spend."
- The settings' warning and the run dialog say the groups. A finding that
  holds on one stage reads as it did.
- `findHarnessConfigLimits` is unchanged: its per-stage findings are what
  the CLI's checks and other readers use.

## Capabilities

### New Capabilities

(none)

### Modified Capabilities

- `agentic-harness` - findings are said once each.

## Impact

- `packages/core/src/harness-config-findings.ts` and its test; the
  browser entry exports the grouping.
- `packages/webui/src/components/harness-settings-parts.tsx` and
  `RunDialog.tsx`, with a settings view test.
- One requirement in `openspec/specs/agentic-harness/spec.md`.

## Explicitly out of scope

- **The CLI's `doctor` and `validate` output.** A terminal line per stage is
  what a script greps; left as it is.
