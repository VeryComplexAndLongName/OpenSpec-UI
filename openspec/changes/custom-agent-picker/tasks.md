`findCustomAgents` reads directories, so it imports `node:fs/promises`
and the browser cannot call it. Same plumbing the run figures needed: a
route, a client, a component.

## 1. The route

- [x] 1.1 `POST /api/custom-agents` — body `{ cwd }`, authorised by the
  same `authorizeCwd` every other route uses.
- [x] 1.2 Returns every definition found, each with its family, so the
  browser can filter per stage as the stage's agent changes.
- [x] 1.3 A workspace defining none returns an empty list, not an error.
  That is the ordinary case, including in this repository.
- [x] 1.4 The user-level directory is read from the server's own home, as
  the CLI would.

## 2. The client and the picker

- [x] 2.1 A client module beside the other clients, not in the bootstrap
  script.
- [x] 2.2 A select per stage, offered only where that stage's agent has a
  `customAgentFlag`, listing only that CLI's family.
- [x] 2.3 The description beside the name, where the definition carries
  one. Two names alone give no help choosing between them.
- [x] 2.4 No empty control. Where the stage's agent takes none, or the
  workspace defines none, say which of the two it is and name the
  directories that were read.
- [x] 2.5 A configured name the discovery does not find stays selected,
  marked as not found.
- [x] 2.6 Saved as the stage's `customAgent`, on both the global and the
  per-change form, without disturbing the stage's other fields.

## 3. Tests

- [x] 3.1 The route returns what the discovery found, and an empty list
  for a workspace with no definitions.
- [x] 3.2 The route refuses a request with no cwd, and is authorised by
  the same `authorizeCwd` as its neighbours.
- [x] 3.3 A stage using `claude-cli` is offered the claude definitions and
  not the copilot ones.
- [x] 3.4 A stage using an agent with no flag is offered no picker, and
  the reason is on screen.
- [x] 3.5 A configured name absent from the discovery stays selected and
  is reported as not found.
- [x] 3.6 Saving writes `customAgent` for that stage and leaves the
  stage's agent, model, effort and budget alone. The model half was a
  live defect, not a guard: this form has no model control, and saving
  deleted a hand-written one. Fixed here, since adding a field that
  round-trips beside one that does not would be shipping the
  inconsistency knowingly.

## 4. Verification

- [x] 4.1 `openspec validate --strict --changes`.
- [x] 4.2 `npm run verify` unpiped, after the last edit, with everything
  staged. Piping it through `tail` reports the pipe's exit code, which is
  how a failing suite read as green on 2026-09-09.
  Run 2026-09-09: exit 0 — 48 cli, 781 core, 305 extension, 68 server,
  313 webui.
- [x] 4.3 Version bump via `npx changeset` for `core`, `server` and
  `webui`.
- [x] 4.4 `HARNESS.md`: where a custom agent is chosen, alongside what a
  `stepAgents` entry accepts.
- [x] 4.5 A screenshot of the picker, captured by the browser suite
  rather than by hand. The fixture writes a real
  `.claude/agents/spec-reviewer.md` — the same file `claude --agent`
  reads — so the image shows the picker rather than its "defines none"
  note, and the capture waits for the route's answer.
- [ ] 4.6 **Human-only**: define an agent in `.claude/agents/` here, pick
  it for a stage, save, and confirm the written `harness.json` names it.
  Neither directory exists on this machine, so every test in this change
  is a fixture and nothing has met a real definition.
