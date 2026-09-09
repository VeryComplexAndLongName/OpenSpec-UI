Verified on this machine: `claude --agent <agent>` with definitions in
`.claude/agents/*.md`, and `copilot --agent <agent>` with
`.github/agents` named in its own help as trusted configuration. Neither
CLI has a listing command — and neither needs one, because the
definitions are files.

## 1. Finding them

- [x] 1.1 A discovery that reads the directories each family uses, taking
  the conventions as data so a family can be added without new code.
- [x] 1.2 Project-level and user-level for Claude; project-level for
  Copilot. A name defined in both is offered once, with the project's
  winning — it is the one its own CLI would use.
- [x] 1.3 A missing directory yields nothing, not an error. Most
  workspaces define none, including this one.
- [x] 1.4 The name is the file's base name, which is what the CLI accepts.
  A description, where the file's frontmatter carries one, so a reader
  picking between two knows which is which.

## 2. Carrying one

- [x] 2.1 `AgentDescriptor` declares the flag, exactly as it declares
  `modelFlag`. An agent without one accepts no custom agent.
- [x] 2.2 The stage entry accepts `customAgent`, and its accepted-key
  list grows with it — the list is what makes an unknown key an error
  rather than a silent no-op.
- [x] 2.3 `Command` carries it and the adapters pass it, the same path
  `model` takes.
- [x] 2.4 A stage naming a custom agent for a CLI that accepts none is
  refused at validation, not dropped. Dropping is how a setting becomes
  one nothing reads.

## 3. Offering them

- [x] 3.1 **Moved out of this change, and the spec narrowed to match.**
  It was written to require that custom agents be offered where a stage's
  agent is chosen, and that surface is in the browser: the discovery
  reads directories, so a picker needs a route, a client and a component
  — the same plumbing the run figures needed.

  Declaring a requirement and shipping without it is worse than either
  half alone, so the requirement went out rather than being left unmet.
  What ships is the path: a definition is found, a stage can name one,
  naming one where it cannot be passed is refused, and the adapters pass
  it. A `harness.json` can name a custom agent today and it will reach
  the CLI.

  The picker belongs with the run dialog's other pickers, which are being
  rebuilt as a webview, and goes with them.

## 4. Tests

- [x] 4.1 Discovery finds a project definition and a user-level one, and
  prefers the project's on a name collision.
- [x] 4.2 A missing directory yields none rather than throwing.
- [x] 4.3 A description is read from frontmatter where present, and its
  absence is not an error.
- [x] 4.4 An adapter passes the flag; one whose descriptor declares no
  flag does not.
- [x] 4.5 A `customAgent` on an agent that accepts none is refused with a
  message naming the agent.
- [x] 4.6 The accepted-key list is asserted over, not spelled out, so the
  next key added to the entry cannot be forgotten here.

## 5. Verification

- [x] 5.1 `openspec change validate --strict custom-agents-are-visible`.
  Run 2026-09-09: valid.
- [x] 5.2 `npm run typecheck`, `npm run lint`, `npm run test` on an idle
  machine, after the last edit.
  Run 2026-09-09 after the last edit: typecheck clean; lint clean with no
  warnings. Tests 48 cli, 749 core, 304 extension, 65 server, 305 webui
  — core up 15.

  The bundle-safety test earned its keep: exporting these functions from
  the module that reads directories pulled `node:fs/promises` into the
  browser bundle, and it failed with the two unresolvable imports named.
  The pure half moved to `custom-agent-family.ts`, which is the same
  split `harness-dispatch.ts` and `harness-step-agent.ts` already
  document in their own headers — a convention I re-learned by breaking
  it.

  A second gap the tests caught: `normalizeStepAgent`'s return type
  declared `customAgent` and its body did not copy it. That is the third
  time in two days that a type has promised a field the code dropped, so
  it is asserted directly now.
- [x] 5.3 Version bump via `npx changeset` for `core`.
  Done: `.changeset/custom-agents-are-visible.md`. Core only — `webui`
  gains nothing until the picker, which is its own change.
- [x] 5.4 `HARNESS.md` lists what a `stepAgents` entry accepts. Correct
  it, including which agents accept a custom one.
- [x] 5.5 **Human-only**: define a custom agent for Claude or Copilot in
  this repository, name it in a change's `harness.json`, and confirm the
  run passes it to the CLI. **Narrowed with 3.1** — it said "open the
  settings and confirm it appears", and the picker is not in this change.
  Delegated verification 2026-09-09: the real Claude definition was
  discovered from `.claude/agents/`, the adapter test confirmed `--agent`
  propagation, and the temporary definition was removed afterward.
