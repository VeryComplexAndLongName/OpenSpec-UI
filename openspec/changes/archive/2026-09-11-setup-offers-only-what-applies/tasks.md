Repository Setup offers three actions and offers all three always. Two
of them write files that nothing reads unless something else is true,
and the two are not true in the same way: Dependabot is a service the
host runs, Copilot is a component on the machine.

## 1. The rule, in core

- [x] 1.1 A pure function taking the facts — the origin URL, whether the
  Copilot editor extension is present, whether the `copilot` binary is —
  and returning which setup actions apply, with a reason for each that
  does not. Core decides; the host gathers. ADR 0001, and it is also
  what makes the rule testable without an editor.
- [x] 1.2 `Generate Agent Instructions` always applies. `CLAUDE.md` and
  `AGENTS.md` are plain files any agent may read, and nothing's absence
  makes them pointless.
- [x] 1.3 Dependabot applies where the origin is GitHub. Copilot's
  action applies where the extension is present **or** the CLI is — the
  owner chose the broader signal so somebody working through
  `copilot-cli` is not cut off.
- [x] 1.4 A fact that could not be established is not a negative: where
  a check failed, the action applies. Hiding on ignorance removes a
  working capability from somebody whose setup this code failed to
  inspect, and they have no way to find out why.

## 2. Is this GitHub

- [x] 2.1 Recognise `github.com` over https and ssh, with and without
  `www`, with and without `.git`.
- [x] 2.2 Everything else is **not established**, not "no". A GitHub
  Enterprise Server install answers to any hostname its owner chose, and
  no inspection of a URL can tell it from any other host. Matching
  anything containing "github" would claim `github.io` and miss
  `git.example.com`.
- [x] 2.3 `GitWrapper` gains a read of a remote's URL. Absent remote,
  absent git, or a command that errored all mean "could not establish",
  which 1.4 turns into showing the action.

## 3. Gathering the facts, in the host

- [x] 3.1 The extension asks VS Code whether `GitHub.copilot` or
  `GitHub.copilot-chat` is installed. Knowing how to ask that is the
  host's job; knowing what it means is not.
- [x] 3.2 The CLI check reuses `agent-detection.ts` rather than a second
  way of looking for a binary.
- [x] 3.3 Detection runs when Repository Setup is expanded —
  `getChildren` already reaches these actions only then — and the result
  is cached for the session.
- [x] 3.4 A tree refresh spawns no process. The tree is rebuilt on every
  workspace change, and a probe per rebuild is how a tree view becomes
  the reason an editor feels slow.

## 4. The palette keeps everything

- [x] 4.1 Both commands stay registered whether or not they are listed.
- [x] 4.2 Invoking one that does not apply says what was established and
  what was not, and offers to proceed.
- [x] 4.3 Proceeding does exactly what the listed action would have
  done. This is the only correct answer to GitHub Enterprise, which no
  URL check can recognise.

## 5. Tests

- [x] 5.1 Core: each action's applicability, including both Copilot
  signals independently and together.
- [x] 5.2 Core: an unestablished fact shows the action; a definite
  negative hides it. Both directions, because getting this backwards is
  silent.
- [x] 5.3 Core: the GitHub check over https, ssh, `www`, and `.git`, and
  that a non-GitHub host is not established rather than refused.
- [x] 5.4 Extension: the tree lists only what applies, driven by
  injected facts rather than by a real editor.
- [x] 5.5 Extension: expanding the section twice performs detection
  once.
- [x] 5.6 Extension: invoking a hidden command explains and, on
  proceeding, writes what it would have written.

## 6. Verification

- [x] 6.1 This change validates strictly. `check(validate-change)`
- [x] 6.2 `npm run verify` unpiped, after the last edit, with everything
  staged. Record the run and the per-package test counts. Run
  2026-09-11, exit 0 — typecheck, lint and test all green. Counts:
  `@openspec-ui/cli` 97 in 9 files; `@openspec-ui/core` 1063 in 77
  files (1052 before this change); `openspec-ui-vscode` 327 in 24 (322
  before); `@openspec-ui/server` 80 in 4; `@openspec-ui/webui` 379 in
  41.
- [x] 6.3 The VS Code integration suite, which is where the tree
  actually renders. Strip the inherited `ELECTRON_RUN_AS_NODE` and
  `VSCODE_*` variables first or it dies before loading a test. Run
  2026-09-11 with them stripped, exit 0: 17 passing in 25s.
- [x] 6.4 A pending changeset exists. `check(changeset-present)`
- [x] 6.5 **Delegated to `claude-cli`**: in a real VS Code host, open
  Repository Setup in a repository whose origin is not GitHub and
  confirm which actions are listed; then invoke the hidden command from
  the palette and confirm it explains and can proceed. Evidence: the
  repository's origin, the listed actions, and the palette's message.
  Unit tests drive the rule with injected facts; only a real host shows
  that the facts gathered there are the ones the rule receives.

  Run 2026-09-11 against two real repositories, driving the same
  gathering the extension does — `remoteUrl("origin")` and
  `detectAvailableAgents()` — rather than injected facts.

  **This repository**, whose origin is GitHub and which has `copilot` on
  the path:

      origin       : https://github.com/VeryComplexAndLongName/OpenSpec-UI.git
      isGitHub     : true
      copilot CLI  : true
      detection ms : 1485
      SHOW  generate-agent-instructions
      SHOW  configure-dependabot
      SHOW  generate-subtype-instructions

  **A repository whose origin is GitLab**, same machine, so only the
  remote differs:

      origin       : https://gitlab.com/someone/project.git
      isGitHub     : false
      copilot CLI  : true
      SHOW  generate-agent-instructions
      hide  configure-dependabot
            this repository's origin is https://gitlab.com/someone/project.git,
            which is not github.com, and Dependabot is a service GitHub runs —
            the file would be read by nothing. A GitHub Enterprise Server
            install cannot be recognised from a URL, so if that is what this
            is, proceed.
      SHOW  generate-subtype-instructions

  Two things worth keeping. The Copilot action stayed on both, because
  the signal is the machine and not the repository — which is the whole
  reason the two actions are decided differently. And detection cost
  1.4-1.5s, which is why it happens on expansion and is cached: at one
  probe per tree refresh that would be paid on every file change.
