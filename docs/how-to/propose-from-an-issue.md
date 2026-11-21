# Propose a change from an issue

Start from a request in the repository you have open. Supported forges are
GitHub, GitLab and Gitea, selected from the repository's `origin` as for PR
Review. Use your existing `gh` login or `GITHUB_TOKEN`/`GH_TOKEN` for GitHub,
`GITLAB_TOKEN` for GitLab, or `GITEA_TOKEN` for Gitea. For a self-hosted SSH
origin, configure `GITLAB_URL` or `GITEA_URL` with its web root when needed.
Keep credentials in your environment, never in the issue or source file.

In standalone, open Change Editor, enter the new change id, and use the
"From a repository issue" panel. Enter `123`, `#123`, or a matching issue
URL and select "Show Issue". In VS Code use "OpenSpec Workbench: Create
Change From Issue..." from the Command Palette. The preview opens as plain
text in the native editor.

Examples for a workspace with the matching origin:

- GitHub: `https://github.com/team/project/issues/123`
- GitLab: `https://gitlab.example/group/project/-/issues/123`
- Gitea: `https://git.example/team/project/issues/123`

Read the source link, title, state, update time and request. A source with
more than 512 title characters or 32768 body characters is marked truncated;
read its original link for the rest. Sources over 256 KiB are refused.
Comments, images and attachments are not imported. A PR URL, a URL to a
different repository and a URL with query parameters are refused.

Select "Create Change From Issue" to confirm. Creation re-reads the issue;
if it changed since preview, preview again. This uses the normal creation
workflow: a working directory and branch from `origin/main`, an initial
commit and a push where available. A failed push is reported and does not
discard the created change. With no usable origin the issue cannot be read.

The new directory contains `source-issue.json`, recording the confirmed
snapshot and source link. It is input, not an approved requirement or a
completed proposal. Use the change's existing "Run Change" action and
explicitly run Propose to write its planning artifacts. The agent receives
the snapshot as untrusted reference data under the usual command, cwd and
audit controls. Review the resulting proposal normally. No agent starts,
issue is edited or issue comment is posted just by importing its source.
