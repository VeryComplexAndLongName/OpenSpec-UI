All core writer functions run for real (temporary scratch script, `tsx`,
deleted afterward — `git status` confirmed no trace left) against a real
scratch temp workspace, not mocked:

## 1. Fresh creation

`writeAgentInstructions(root, "node")` on an empty workspace: `{ claude:
"created", agents: "created" }`. Read `CLAUDE.md` back — real managed-
section markers, real Node.js/TypeScript content.

## 2. Foreign-file detection

Hand-wrote `CLAUDE.md` to `"# Hand-written, not ours\n"`, then called
`writeAgentInstructions(root, "python")`: `{ claude: "skipped-foreign",
agents: "updated" }` — exactly as designed, `CLAUDE.md` untouched (still
the hand-written line), `AGENTS.md` updated independently since it was
still managed.

## 3. Regeneration preserves content after the end marker

Appended `"## My own section\n\nKeep this.\n"` after `AGENTS.md`'s
managed block, then regenerated with `"node"`: the managed block switched
to the new content (confirmed `Contains 'Node.js': true`) and the
user-appended section survived verbatim (confirmed `Contains user
section: true`). `CLAUDE.md` correctly stayed `skipped-foreign` (still
hand-written from step 2 — the ownership state persists correctly across
calls, not reset).

## 4. Subtype instructions

`writeSubtypeInstructions(root, "python", "backend")` → `"created"`; read
file back — real `applyTo: "**"` frontmatter immediately followed by the
managed block with the actual Python backend-specific content.

## 5. Dependabot accumulation across invocations

`writeDependabotConfig(root, ["node"])` → `"created"`. Then
`writeDependabotConfig(root, ["python"])` → `"updated"`. Read the file
back: contains all three of `npm`, `pip`, and `github-actions` entries —
confirms the second call added `pip` without losing `npm` from the
first, exactly the accumulation behavior this change's design.md
specifically called out as a risk to get right.

## Extension: real VS Code Extension Host

`npm run test:integration --workspace openspec-ui-vscode` — 6/6 passing,
including "activates and registers all contributed commands," confirming
the extension activates cleanly with the three new commands
(`generateAgentInstructions`/`configureDependabot`/
`generateSubtypeInstructions`) registered, no runtime errors in a real
VS Code instance.

## Not driven live: actual QuickPick interaction

As with every other VS-Code-UI-only change this session, there is no
desktop-app UI automation tool available in this environment — can't
literally invoke a command from the Command Palette and click through
the QuickPick steps. Coverage for that interaction rests on the 7 new
`commands.test.ts` cases (QuickPick flows, cancellation at each step,
foreign-file warning path, file-opening on success) plus the real
Extension Host activation check above.
