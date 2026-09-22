# LinkedIn post: one interface, three forges

Publish on 2026-09-30: a few days after the site page (2026-09-26), not the same day.
Attach: `docs/articles/site/one-interface-three-forges/diagram.png`.
Put the repository link in the first comment, not in the post.

## Post

"Support GitLab too" usually means one more if-statement wrapped around code that still only really knows GitHub.

I did it the other way in OpenSpec Workbench: one Forge interface (list, open, merge, read checks), three real implementations behind it, chosen by reading the repository's own remote. GitHub, GitLab or Gitea, and GitHub now goes through its own API too when a token is set, not only through the gh CLI.

Testing it against the real hosts is where it got interesting:

- Gitea 404s a pull request listing on a repository with one branch, instead of returning an empty list
- GitLab refuses a merge with 422 the instant a request opens, because it has not finished deciding whether it can merge yet, not because it can't
- GitHub refuses automatic merge outright on a brand-new repository until you turn the setting on

None of that is in the getting-started docs. All of it showed up the first time each path ran against a real account.

Full write-up, with what still isn't covered: https://openspec-ui.dev/articles/one-interface-three-forges/

If you've built against more than one git host's API, what's the quirk nobody warns you about?

## First comment

The code, the issues and the extension: https://github.com/VeryComplexAndLongName/OpenSpec-UI
(The product is OpenSpec Workbench. The repository and packages are still called OpenSpec-UI.)

## Where each claim comes from

Not for posting.

- The Forge interface and how it picks a host: the archived changes
  `the-forge-is-gitlab-or-gitea-too` and `github-without-gh`.
- The live quirks (Gitea's 404, GitLab's 422, GitHub's refused auto-merge):
  each change's own `tasks.md`.
- The article itself: `docs/articles/site/2026-09-26-one-interface-three-forges.md`.