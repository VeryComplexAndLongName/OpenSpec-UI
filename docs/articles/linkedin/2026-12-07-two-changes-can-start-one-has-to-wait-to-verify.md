# LinkedIn post: two-changes-can-start-one-has-to-wait-to-verify

Publish on 2026-12-07, three days after the site article on 2026-12-04.
Attach `docs/articles/site/two-changes-can-start-one-has-to-wait-to-verify/cover.png`.
Put the repository link in the first comment.

## Post

One change adds an interface. Another adds a consumer. The consumer can implement against the agreed contract while the interface change is still active. Verify needs the landed spec.

Workbench can express both kinds of dependency. `blocked_by` holds the run before its first stage. `await-change` can pause it before Verify and continue when the dependency's archive is visible to that workspace.

The article shows both declarations on the same pair of changes.

Full write-up: https://openspec-ui.dev/articles/two-changes-can-start-one-has-to-wait-to-verify/

## First comment

OpenSpec Workbench code and issues: https://github.com/VeryComplexAndLongName/OpenSpec-UI
