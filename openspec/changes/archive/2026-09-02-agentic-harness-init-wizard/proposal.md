## Why

Raised directly in a repository conversation on 2026-08-31, as a direct
follow-up to `agentic-harness-change-template`: creating a *change* can
now ask about the Agentic Harness (`openspec-ui.createChangeTemplate`),
but there is still no first-run flow for the *repository-wide* default
(`openspec/agent-harness.json`) — a user who runs `openspec-ui.initialize`
today gets an OpenSpec scaffold and picks AI-tool integrations, but the
global `stepAgents`/`autonomyLevel` choice, and whether CLAUDE.md/
AGENTS.md exist at all, are left entirely to a later, separate, easy-to-
never-discover "Configure Harness Settings" action. This repository's own
`openspec/agent-harness.json` (propose/review/archive → Claude, apply →
Copilot) is exactly the kind of decision a new user should be prompted
for once, up front, not left to stumble into.

Second, separate risk raised directly in review on 2026-08-31, specific to
`claude-cli`: per `docs/adr/0013-acp-agent-adapters.md` /
`openspec/changes/acp-agent-adapters/`, `claude-cli` is the one agent in
`AGENT_REGISTRY` with no native ACP mode — its ACP-flavored adapter is
instead an in-house translation of `claude --input-format stream-json
--output-format stream-json --verbose`'s structured output, an
undocumented, non-versioned CLI surface (unlike the other three agents'
ACP-flavored adapters, which speak an actual versioned protocol with its
own negotiation). That translation was built and verified against one
exact `claude` CLI version (`2.1.237`, per `acp-agent-adapters/design.md`'s
own live spike); a materially different installed version is a real,
silent-breakage risk this wizard is well-placed to surface, since it
already runs `detectAvailableAgents()` and already asks which agent(s) the
harness will actually depend on.

## What Changes

- New re-runnable command `openspec-ui.setUpAgenticHarness` ("OpenSpec
  UI: Set Up Agentic Harness"), plus an automatic, dismissible suggestion
  (`showInformationMessage` with an action button, not a blocking dialog)
  right after `openspec-ui.initialize` succeeds — shown only when
  `openspec/agent-harness.json` does not already exist, so an
  already-configured workspace is never re-prompted.
- Flow: `detectAvailableAgents()` first (already used to annotate the
  Agent Selection picker — no new detection mechanism). If nothing is
  detected, skip the agent questions with a short explanatory message and
  go straight to the CLAUDE.md/AGENTS.md offer. Otherwise, ask (each
  offered choice limited to actually-detected agents):
  1. Which agent handles process control (`propose`/`review`/`archive`)?
  2. Which agent handles implementation (`apply`)? (May be the same
     answer as #1.)
  3. Autonomy level — **`assisted` or `semi-autonomous` only**;
     `autonomous` is not offered, because the existing global-file
     validator (`GlobalAutonomousAutonomyLevelError`) already refuses to
     accept it there — offering an impossible choice would be misleading,
     not merely over-cautious.
  4. Generate CLAUDE.md/AGENTS.md now, if either is missing? — reuses
     `openspec-ui.generateAgentInstructions`'s existing
     `listBootstrapProjectTypes()`/`writeAgentInstructions()` call
     verbatim, asked only if at least one of the two files is absent.
  `reviewGate.mode` is not asked — it is fixed to `human-required` at the
  global level already; there is nothing to choose.
- Unlike `openspec-ui.createChangeTemplate`'s all-or-nothing wizard,
  cancelling (Esc) here keeps whatever was already answered and simply
  stops asking further questions — see design.md, "Cancellation is
  per-question here, not all-or-nothing" for why the two commands differ.
- Writes only the fields actually answered, via the existing
  `writeGlobalHarnessConfig`.
- If `claude-cli` is chosen for either role (control or apply) **and**
  `acp-agent-adapters` has landed by the time this task is implemented
  (its `claude-cli-acp` module exporting a tested-version constant — see
  design.md for what happens if the ordering is reversed): runs `claude
  --version`, parses the version token out of its plain-text output
  (confirmed live this session: `2.1.237 (Claude Code)` — not JSON,
  despite `claude`'s CLI otherwise offering JSON output modes for other
  commands), and shows a dismissible warning if it does not match the
  version `claude-cli-acp` was last verified against. This does not block
  proceeding — see design.md for why a warning, not a hard stop.

## Capabilities

### New Capabilities

(none — this extends `agentic-harness` and `vscode-extension`)

### Modified Capabilities

- `agentic-harness`: a guided first-run path to the global config,
  alongside the existing manual "Configure Harness Settings" action.
- `vscode-extension`: new command, plus a post-`initialize` suggestion.

## Impact

- `packages/extension/src/commands.ts`: new `openspec-ui.
  setUpAgenticHarness` handler; `openspec-ui.initialize`'s handler gains
  the post-success suggestion (only change to existing command behavior).
- `packages/extension/package.json`: command registration (Command
  Palette only — see design.md for why no tree/menu entry is added).
- `openspec/specs/agentic-harness/spec.md`: new requirement for the
  guided first-run flow, plus the `claude-cli` version-compatibility
  warning (conditional on `acp-agent-adapters` — see design.md and
  tasks.md 1.4).

## Process note (how this gets implemented)

Per the workflow agreed on directly: this proposal/design/tasks is
authored and controlled here (propose/review/archive); the `apply` stage
(actual code) is intended to run through this repository's own
`openspec/agent-harness.json` — already set to `copilot-cli` for `apply`
— via "Run with Agentic Harness" (`agentic-harness-run-menu`) once this
change is ready to implement. Not started immediately: another agent is
currently mid-work in this same working copy, and starting a `copilot`
CLI run concurrently risks colliding with its uncommitted changes.
