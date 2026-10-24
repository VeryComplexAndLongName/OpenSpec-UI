# 0052: An ACP Agent's Settings Are Session Options, Checked Then Set

Status: Accepted

Date: 2026-10-24

## Context

`codex-cli-acp` ran the externally installed `codex-acp` with no arguments
and set nothing: no model, no effort, no sandbox. Its capabilities entry
was deliberately empty, written when the bridge had never been installed
here, on the assumption that `codex-acp` had no surface for either
setting. On 2026-10-24 `@agentclientprotocol/codex-acp` 2.2.2 (the
maintained successor of the deprecated `@zed-industries/codex-acp`) was
installed and read live:

- **It takes no arguments, and needs none.** Its `session/new` answer lists
  `configOptions`: `mode` (`read-only`, `workspace-write`, `agent`,
  `agent-full-access`), `model` (seven models), `reasoning_effort` (`low`
  to `ultra`), `collaboration_mode` and `fast-mode`. Each is set with ACP's
  `session/set_config_option`, and the answer echoes every option's new
  value.
- **Its default mode is `agent`, "Auto review".** What that lets through is
  codex's decision, not the stage's.
- **In `workspace-write` it wrote its file without asking**, and its
  prompt's answer carried `inputTokens`, `cachedReadTokens`,
  `cachedWriteTokens`, `outputTokens` and `thoughtTokens`, with a context
  gauge in `usage_update`.
- **The shared driver read the cached tokens under names nobody sends**
  (`cacheReadTokens`, `cacheCreationTokens`). ACP's schema calls them
  `cachedReadTokens` and `cachedWriteTokens`, so no ACP agent's cached
  input had ever been recorded.

`deepseek-cli-acp` also offers its models as a session option and sets
none; the other ACP adapters pass their settings as command-line flags.

## Decision

**An ACP adapter whose agent takes its settings as session options names
them to the shared driver, which checks every one against the
`configOptions` of `session/new` and only then sets them, in order, with
`session/set_config_option`, before the prompt.** An option the session
does not list (`OSW-AGT-223`) or a value it does not list for that option
(`OSW-AGT-224`) fails the run before anything is set or prompted, naming
what the session does offer. A value is never sent on trust: an agent
may take one it does not know and run with something else.

For `codex-cli-acp` that is:

- `mode`: the sandbox `codex-cli` names for the same command (ADR 0051) -
  `workspace-write` for plan, implement, update and verify, `read-only`
  for the rest. `codex-acp` uses the same two names. Neither `agent` nor
  `agent-full-access` is used.
- `model`: the stage's model, where it names one.
- `reasoning_effort`: the stage's effort, where it names one, from `low`,
  `medium`, `high`, `xhigh` and `max`. `ultra`, "automatic task
  delegation", is offered by the session but not by this project, as for
  `codex-cli`.

The driver reads cached input by the schema's own names.

## Consequences

- `codex-cli-acp` can take a model and an effort, and its capabilities say
  so: `reports: "tokens-only"`, `contextGauge: "sends"`, both measured.
- The check needs no catalog of its own and no extra process, unlike
  `codex-cli`'s `codex debug models`: the session lists what it offers in
  the answer the run already waits for.
- A session option is checked against one session, the one the run
  opens. A setting the bridge drops in a later version is refused in
  words at the next run, not silently ignored.
- Any ACP agent's cached tokens are now recorded where it sends them;
  before, a run's input looked smaller than it was by its cached part.
- `deepseek-cli-acp` could pass its model the same way. That is left to
  a change of its own, as is `collaboration_mode` and `fast-mode` for
  codex.

## Alternatives considered

**Send the options without checking them.** `codex-acp` answers a value
it does not know with an error, but the protocol does not oblige an agent
to; a run that silently went on with the agent's default model would be
reported as run with the one configured.

**Set `mode` to `agent` and answer permission requests.** The stage
would then depend on what codex's own review decides to ask. Naming the
sandbox keeps what a stage may do in this project's hands, as ADR 0051
does for `codex-cli`.

**Read the cached tokens under both spellings.** No agent sends the old
names; keeping them would document a field that does not exist.
