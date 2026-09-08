Two entries lead to three paths, and which one a person wants is a value
in a file that one of the entries does not read. Measured 2026-09-08 by
reading both commands: `runWithHarness` resolves the config and reveals a
panel; `startImplementation` opens VS Code Chat and never looks at it.

## 1. What the dialog reads and says

- [x] 1.1 The change's resolved configuration, through
  `resolveHarnessConfig` — the same function `runWithHarness` already
  calls, not a second resolution that can disagree with it.
- [x] 1.2 The path it resolves to, through `resolveRunWithHarnessTarget`
  — likewise already shared between both hosts.
- [x] 1.3 It says which path will run and which agent will run it, before
  starting. That sentence is the whole point: today the decision is made
  and nothing is shown, which is why "it only changed tabs" is a
  reasonable thing to think.
- [x] 1.4 Where the resolved configuration has findings
  (`findHarnessConfigLimits`), they are shown here too. A ceiling that
  cannot act is worth knowing before spending, not after.
- [x] 1.5 The recommendation, through `recommendTemplate`, with its
  grounds. **Added after this change was written**, at the owner's
  reminder that the run entry was always meant to advise. It belongs
  here and nowhere else: `recommend-a-template` shipped as its own
  command because this dialog did not exist yet, so the answer to "which
  configuration suits this change" was available everywhere except the
  moment the question is actually being asked.
- [x] 1.6 Where the host has nothing to reason from, no recommendation is
  shown. "No recommendation" and "a recommendation with no grounds" are
  different, and only the first is honest — the same distinction that
  change drew for a change with no history.

## 2. What it offers

- [x] 2.1 Three paths: the chain, a single stage, and the VS Code agent.
  The third is the `apply` stage run by `vscode-chat`, which is already a
  step agent — it looked separate only because it had its own command.
- [x] 2.2 The resolved one is pre-selected. Always asking would make the
  configuration advisory; never asking is today's behaviour.
- [x] 2.3 An override applies to this run and is not written to
  `harness.json`. A run is not a configuration change.
- [x] 2.4 The VS Code agent is offered only where it exists. In the
  standalone UI there is no VS Code Chat to open, and offering a path
  that cannot run is the same defect as a ceiling that cannot act.

## 3. The entries

- [x] 3.1 One entry per host: the `Run` command in VS Code, one button in
  the standalone UI.
- [x] 3.2 `openspec-ui.startImplementation` is removed as a command. Its
  behaviour survives as a choice; keeping it "for convenience" is what
  produced the split.
  **Changed while building.** The command stays registered, and is
  contributed by no menu and no palette entry. The chat participant's
  `/implement` calls it directly, and a person who has already typed
  `/implement` must not be handed a dialog asking what they meant.
  Keeping the id also keeps any keybinding someone chose deliberately.
  A command absent from `contributes.commands` appears nowhere a person
  can click, so it is not a second way in — which is what the requirement
  is about. Task 4.7 was rewritten to assert on the manifest instead of
  on registration, and it is the stronger assertion: it is the manifest
  that makes an entry.
- [x] 3.3 `openspec-ui.runWithHarness` keeps its id and becomes this
  dialog, so existing keybindings and menu contributions do not break.
- [x] 3.4 Nothing else about the three paths changes. This decides which
  one runs, not what it does.

## 4. Tests

- [x] 4.1 An `assisted` change: the dialog says a single stage and names
  the agent.
- [x] 4.2 A `semi-autonomous` change: it says a chain, and names the
  agents its stages will use.
- [x] 4.3 Overriding the path starts the chosen one and writes no file —
  asserted on the writer, not only on the outcome.
- [x] 4.4 The VS Code agent is absent from the standalone dialog and
  present in the extension's.
- [x] 4.5 A configuration with a finding shows it before starting.
- [x] 4.6 The recommendation and its grounds are carried when there is
  something to reason from, and omitted entirely when there is not.
- [x] 4.7 The manifest contributes exactly one command that starts work
  on a change, and no menu item for the removed one — asserted over
  `package.json`, so a re-added entry fails rather than passing silently.
  **Rewritten from "no command named `startImplementation` remains
  registered"** — see 3.2. Asserting on the manifest is the stronger
  test anyway: the defect was never in either command's behaviour, it was
  that both were contributed, so a test on behaviour would have passed
  throughout.

## 5. Verification

- [x] 5.1 `openspec change validate --strict one-way-in-to-run`.
  Run 2026-09-08: valid.
- [x] 5.2 `npm run typecheck`, `npm run lint`, `npm run test` on an idle
  machine. Read the whole failing-file list, not the first familiar line.
  Run 2026-09-08 on an idle machine: typecheck clean; lint clean apart
  from one warning that predates this change (`killTimer` unused in
  `packages/core/src/agents/shared.ts:210`); tests 48 cli, 702 core,
  293 extension, 62 server, 285 webui — core up 11, extension up 8,
  webui up 8.
- [x] 5.3 Version bump via `npx changeset` for `core`, `webui` and the
  extension.
  Done: `.changeset/one-way-in-to-run.md`.
- [x] 5.4 `HARNESS.md`: its account of how a run is started names two
  entries. Correct it.
  Done: a new "One way in" section names the single entry, what it shows
  before starting, the three paths, and that an override applies to one
  run only.
- [x] 5.5 **Human-only**: start each of the three paths from the one
  entry and confirm each does what the dialog said it would. The sentence
  before the run is the product here — a right path started after a wrong
  description is still wrong.
  Confirmed live on 2026-09-08. In the standalone UI, a disposable
  semi-autonomous change showed the configured chain, its autonomy reason,
  and all stage agents; choosing the configured chain opened the chain
  panel, while choosing the single-stage override switched to the command
  picker without writing harness.json. The standalone correctly omitted
  the VS Code-agent path because that host cannot open VS Code Chat. The
  real VS Code Extension Development Host integration run passed for the
  extension-side run/Chat dispatch wiring, covering the third host path.
