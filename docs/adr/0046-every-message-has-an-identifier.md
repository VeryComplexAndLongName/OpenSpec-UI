# 0046: Every Message Has an Identifier

Status: Proposed

Date: 2026-10-08

## Context

What the product says to a person - a failure's reason, a refusal, a
warning, a notification, a CLI error - is written where it is said, as a
sentence. The same situation is worded differently in the core, the CLI
and each host; a person cannot search for a message they saw, a host
cannot react to one except by reading its text, and nothing says which
messages exist. The owner asked on 2026-10-08 for every message to be
said as `<identifier>: <message>`, with identifiers in groups.

## Decision

1. **Form.** A message is said as

   ```
   <level> OSW-<GROUP>-<NNN>: <message>
   error OSW-RUN-104: "apply" changed no file and ticked no task, ...
   ```

   `OSW` is the product's prefix (OpenSpec Workbench). The level is
   `error`, `warning` or `info`. The number has three digits within its
   group, and is never reused: a message that goes is marked retired, and
   its identifier stays reserved, so an old log never names a different
   message.
2. **Groups** use the nouns of ADR 0045, so a message and the action that
   deals with it share a word:

   | Group | About |
   | --- | --- |
   | `CHG` | a change: finding, creating, deleting it, where it lives |
   | `RUN` | runs, chains, stages, checkpoints, limits |
   | `QST` | questions to the operator |
   | `PRM` | permission requests |
   | `HRN` | harness settings |
   | `AGT` | agents and adapters: missing, signed out, failed |
   | `TSK` | tasks: ticks, Human-only, delegation |
   | `VAL` | validation, the merge gate, checks |
   | `ARC` | archiving |
   | `GIT` | git, branches, worktrees, push, pull requests |
   | `WSP` | the workspace: setup, lease, locks |
   | `KEY` | signatures, keys, the team |
   | `NET` | network, proxy, the local LLM |
   | `CLI` | the CLI's arguments and subcommands |

3. **One register in core.** Each message has its identifier, level, a
   text with named parameters, why it happens and what to do. Code says a
   message by its identifier, never as a sentence written in place.
   `docs/messages.md` is generated from the register: for every
   identifier, what it means, why, and what to do - a page a person can
   search for the code they saw.
4. **Said the same everywhere.** The CLI prints the form above, and its
   JSON carries `code` beside the text; VS Code notifications lead with
   the identifier; the panels and the card show it as a small label that
   links to its entry. Protocol events that carry a reason (`failed`,
   `cancelled`, `progress`, refusals) carry `code` too, so a host can act
   on a message without reading its words.
5. **Tests hold it**: identifiers are unique and each has its entry; an
   identifier once given stays in the register; and a ratchet counts the
   messages not yet in the register and lets that number only fall.
6. **In steps.** The register, the form and the first groups - `CLI`,
   `RUN`, `QST`, `PRM` - come first; the other groups move in later
   changes, one or a few groups at a time, under the ratchet.

## Consequences

- A person who sees `OSW-RUN-104` can look it up, and reports it by its
  code.
- Hosts and the supervisor decide on codes, not on wording, so wording can
  improve without breaking them.
- Every message is written once, and the register shows which exist.

## Alternatives considered

- **Numeric groups (`OSW2104`, as TypeScript does).** Rejected by the
  owner: three letters read and search better.
- **All messages at once.** Rejected: hundreds of sentences in one diff;
  the ratchet keeps new messages in the register while the rest move.
