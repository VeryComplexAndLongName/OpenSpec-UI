## Context

`repo-bootstrap.ts` writes a managed block of project-type guidelines into
`CLAUDE.md` and `AGENTS.md`, owning a file only where it starts with its
marker. `planChangeWorktree` refuses a change not in the base commit.
`createChange` runs `openspec new change` in the host's workspace.

## Decisions

1. **A section of its own, `<!-- openspec-ui:workflow start/end -->`.** It
   lives beside the guidelines block in either order: a file the product
   made with the guidelines is its own, and the rules go after them
   without asking; a file made with the rules alone takes the guidelines
   in front. Both markers sit in `managed-sections.ts`, so neither writer
   imports the other.
2. **The repository's own name, and the rule for the root.** The text names
   `../.worktrees/<repository>/<change-id>` and the two settings that move
   it; never an absolute path.
3. **Consent.** `workflowRulesNeedConsent` lists the files that exist
   without the section and are not the product's; the editor asks Yes/No,
   the standalone's init form has a checkbox, checked, beside the button.
   A file left as it was is named in the result and said.
4. **`planChangeWorktree`**: the "not in base" refusal applies only where
   `openspec/changes/<id>` exists in the main checkout.
5. **`createChangeInItsWorktree`**: no `origin` → `openspec new change` in
   the workspace, as before; otherwise fetch (a failure leaves the last
   reading, which is a sound base), plan with base `origin/main`, add the
   worktree, and run `openspec new change` in it. Both hosts call it; the
   editor offers to open the directory, the standalone's page switches its
   workspace root to it and opens the change in the editor.
6. **The standalone's `cwd` policy** also allows
   `<worktree root>/<repository>/`, resolved once at start, so the page can
   follow the change.

## Risks / Trade-offs

- **A person who wanted the change in the checkout.** It is now in a
  directory beside it; the message says where, and a repository without a
  remote keeps the old place.
- **Older repositories** have no section until "Write Agent Workflow
  Rules" is run.