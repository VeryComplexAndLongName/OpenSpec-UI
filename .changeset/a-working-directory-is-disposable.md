---
"@openspec-ui/core": minor
"@openspec-ui/cli": minor
---

Working directories go under one root, and removal takes their run history first.

A change's working directory is created at `<root>/<repository>/<change>` rather than beside the repository, so a folder of repositories stays a folder of repositories. The root comes from `OPENSPEC_UI_WORKTREE_ROOT`, then `~/.openspec-ui/settings.json`, then the repository's parent — and never from the repository's own configuration, which travels to every checkout.

`worktree remove` now merges the directory's `audit.jsonl` into the repository's own before deleting anything, and names what it is discarding. The directory's `.openspec-ui/` is gitignored and `git worktree remove` does not see ignored files, so until now the run history every recommendation, timeline and quality figure is built from went with the directory.

`worktree list` reports a directory that is not under the root, and `worktree move` relocates one on request — never as a side effect, since something may be pointing at the path it has.
