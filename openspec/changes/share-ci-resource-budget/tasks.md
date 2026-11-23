## 1. Implementation
- [x] 1.1 Update runner config, guard and regression case; document the host prerequisite in ADR 0061.
- [x] 1.2 Add an empty Changeset because no public package behavior changes.
## 2. Verification
- [x] 2.1 Run node scripts/gitea-ci.mjs, node --test scripts/gitea-ci.test.mjs and openspec validate share-ci-resource-budget --strict locally with pinned runtime.
- [ ] 2.2 Deploy only after runner 24 drains; verify live cgroup and full Gitea quality gates.
## 3. Completion
- [ ] 3.1 Review, fetch current main, adapt if necessary and merge after checks.
- [ ] 3.2 Archive with OpenSpec, fetch/check/review/merge the archive, remove the clean own worktree.
