## 1. Implementation
- [x] 1.1 Update runner config, guard and regression case; document the host prerequisite in ADR 0061.
- [x] 1.2 Add an empty Changeset because no public package behavior changes.
## 2. Verification
- [x] 2.1 Run node scripts/gitea-ci.mjs, node --test scripts/gitea-ci.test.mjs and openspec validate share-ci-resource-budget --strict locally with pinned runtime.
- [x] 2.2 Deploy only after runner 24 drains; verify the live job cgroup and shared limits (2026-11-23, run 7203, /user.slice/docker-*.scope).
## Required follow-through after implementation

Full Gitea quality remains a mandatory PR gate. Record its actual result before merge. Review, fetch current main, adapt and rerun affected checks before each merge. Archive with OpenSpec after verification, then merge the checked archive and remove only the clean own worktree. These operations are tracked in the rollout record rather than pre-merge implementation checkboxes: the gate cannot require its own future merge or worktree removal to have already happened.
