## Context

The workspace sweep (ADR 0035, 0036) runs in each host: the extension on
activation and every thirty minutes, and again in five while an archive
pull request is open; the standalone the same through
`createArchiveFollower`. Nothing in it was wrong for a change that landed
while nothing else was going on and the extension was running; the delays
came from when it ran.

## Decisions

1. **Activation.** `activationEvents` names the three files or folders an
   OpenSpec project has (`openspec/changes`, `openspec/config.yaml`,
   `openspec/project.md`). Activation stays cheap: what it does on start
   is what it already did when the view was opened.
2. **When to sweep again soon: one rule in core.** `sweepsAgainSoon(sweep,
   previous)` is the decision both hosts make:
   - an archive pull request open (as before);
   - this pass merged one, and the previous pass had not merged the same
     one: what landed while it was open is due now;
   - the archive failed with a reason the previous pass did not give: a
     refused push is often gone a minute later, and a failure that repeats
     is left to the half hour, not retried every five minutes for ever;
   - a change's own branch is on the server (`awaitingLanding`): read
     offline from `refs/remotes/origin/*` and the survey of working
     directories, so watching for a merge costs a fetch every five minutes
     and no call to the forge.
3. **A failure's reason.** `failureReason` keeps the lines of git that say
   why (`!`, `error:`, `fatal:`, `remote:`), at most two, and falls back to
   the first line.
4. **A failed fetch is said.** A pass with no working directory to sweep
   returns `archiveUnread` with the reason; a pass with working
   directories already said its fetch failed, and now says the archive was
   left too. A workspace whose fetch always fails says so every half hour
   in the output channel, which is where the sweep's lines go; nothing pops
   up.

## Risks / Trade-offs

- **A sweep every five minutes while a change is in review.** It fetches,
  surveys and may rebase a branch that fell behind; it asks the forge
  nothing unless something is due. The half hour is unchanged otherwise.
- **The extension now starts in every OpenSpec workspace.** A person who
  never opens the view gets the sweep anyway; `archive.whenLanded`,
  `branches.rebaseWhenBehind` and `branches.followMain` turn its parts off
  as before.