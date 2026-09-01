# ADR 0016: Harness stage dispatch via the VS Code chat

Status: Accepted

Date: 2026-09-01

## Context

Every Agentic Harness stage today is run the same way: `AgentRunner`
spawns a CLI binary through `cross-spawn`, streams its `stdout`/`stderr`
as `Event`s, and records the run in the `AuditLog`. That is the only
dispatch this product has.

Two things observed on 2026-09-01 put pressure on it:

1. **A CLI stage can be blocked by permissions nobody can grant.**
   `copilot-cli` fails on real work in this repository with `Permission
   denied and could not request permission from user`, reproduced
   identically from a plain shell, the VS Code extension host, and the
   standalone server — so not a defect here. `claude-cli` needed
   `--dangerously-skip-permissions` (ADR-less, shipped as
   `claude-cli-permission-bypass`) for the same structural reason: a
   headless process has no one to ask.

2. **The product already contains a dispatch that does not have this
   problem.** `openspec-ui.startImplementation` ("Implement with VS Code
   Agent") builds a prompt and calls
   `vscode.commands.executeCommand("workbench.action.chat.open", { query,
   mode: "agent" })`. No subprocess, no permission flags: the work runs
   inside VS Code's own chat, the user approves each sensitive action in
   a real UI, and it is billed against their existing subscription rather
   than API credits. The user reports it works reliably, including in
   other repositories where the CLI path does not.

The question this ADR answers is whether the harness may use that second
dispatch for a stage, and under what constraints.

## Decision

Allow a harness stage to be dispatched through the host's chat instead of
a CLI subprocess, as an explicit, narrowly constrained option.

1. **Dispatch is a property of how a stage runs, not of which agent runs
   it.** A stage entry gains an optional `dispatch` field —
   `"cli"` (default, current behavior) or `"vscode-chat"`. It is not a
   new agent id.

2. **`vscode-chat` is valid only in the VS Code delivery target.**
   Resolving it in the standalone server is a configuration error,
   reported when the config is read, not a silent fallback to CLI.

3. **`vscode-chat` is valid only under `autonomyLevel: assisted`.** A
   chain cannot use it — see Consequences.

4. **A chat-dispatched stage is handed off, not observed.** It emits
   `started`, then a terminal event recording that the stage was handed
   to the host's chat. It produces no `stdout`/`stderr` stream, no
   progress, and no `AuditLog` entry for the work itself.

## Consequences

- **Chains genuinely cannot use it, and this is not a limitation to work
  around later.** `HarnessChainRunner` advances when a stage reports a
  terminal event. `workbench.action.chat.open` returns once the chat is
  open; nothing reports when the user's chat session finished, whether it
  succeeded, or whether it did anything. A chain whose `apply` stage is
  chat-dispatched would either advance immediately to `archive` while the
  work is still in progress, or hang forever. Both are worse than
  refusing the configuration.
- **The two delivery targets stop being symmetric for this one field.**
  ADR 0001's invariant is that *business logic* lives in `core` and the
  hosts are thin adapters for their own transport — and it explicitly
  favours using native host capabilities ("maximum use of native API
  instead of custom UI"). Handing a prompt to the host's own chat is a
  host affordance of exactly that kind, like the diff editor or the Git
  API the extension already prefers. The asymmetry is therefore in what
  a host *can offer*, not in where behavior lives.
- **No audit record for the work.** `security.ts`'s allowlist, cwd
  sandbox and `AuditLog` describe a subprocess this product spawns. A
  chat-dispatched stage spawns nothing; the actions are taken by the
  user's own IDE agent, under their per-action approval. This is not a
  new hole — `startImplementation` has always worked this way — but it
  does mean a harness run is no longer uniformly auditable, and the UI
  must not present a handed-off stage as if it had been observed.
- **Cost moves from API credits to the user's IDE subscription** for
  whichever stage uses it, which is the practical reason to want it.
- Nothing changes for existing configurations: absent `dispatch`, every
  stage behaves exactly as today.

## Alternatives considered

### A `vscode-chat` pseudo-agent in `AGENT_REGISTRY`

Rejected. `AGENT_REGISTRY` and `buildDefaultAgentRunners` live in
`packages/core`, which cannot construct anything that needs the `vscode`
API. Core would advertise an agent it is structurally unable to run, and
the standalone picker would list an option that can never work there —
not "present but undetected", which the existing "annotate, don't filter"
stance handles, but impossible by construction. Dispatch belongs on the
stage, where the host resolving it can refuse it honestly.

### Make chains work by inferring completion

Rejected. The candidate signals — the chat view closing, `tasks.md`
checkboxes changing, `git status` going quiet — are all guesses about
whether someone else's agent has finished. This repository has already
paid for one silent-completion failure (`changeset-version-automation`'s
task 1.3 marked done without being done), and ADR 0012's terminal-event
contract exists precisely so that `completed` means the work completed.
Inferring it would hollow that out.

### Replace CLI dispatch with chat dispatch entirely

Rejected. It would delete the event stream, the audit log and both
autonomous levels — the whole observable-orchestration premise of ADR
0011/0012 — to solve a permission problem that affects one CLI.

### Do nothing; keep `startImplementation` as the only chat path

Rejected, but it is the closest alternative and worth stating: the
command already exists, so a user can always run implementation through
the chat manually. What it cannot do is participate in the harness at
all — it does not consult `stepAgents`, does not appear as a stage, and
leaves no trace in the harness's own view of the change. The gap this
ADR closes is configuration, not capability.

## Related

- ADR 0001 — delivery model; native-host-capability preference.
- ADR 0011 — `stepAgents`; the config layer this extends.
- ADR 0012 — chain execution and the terminal-event contract that makes
  chat dispatch unusable for chains.
- ADR 0015 — per-stage model selection; the other axis on a stage entry.
- `openspec/changes/claude-cli-permission-bypass/` and the `copilot-cli`
  investigation recorded in `harness-step-models/proposal.md` — the
  permission failures that motivated looking at this dispatch at all.
