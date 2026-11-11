# LinkedIn post: how-codex-runs-a-harness-stage

Publish on 2026-11-17, three days after the site article on 2026-11-14.
Attach `docs/articles/site/how-codex-runs-a-harness-stage/cover.png`.
Put the repository link in the first comment.

## Post

The first Codex file-write trial ended with code 0. The file was missing.

The agent had said the workspace was read-only. That sentence and the process exit code told different parts of the story.

OpenSpec Workbench now names the sandbox for each stage. Review runs read-only. Apply gets workspace-write. The native adapter reads Codex's JSON events. The ACP adapter checks the selected model, effort, and mode against the options the bridge actually offers.

The write-up follows that first trial through both adapters.

Full write-up: https://openspec-ui.dev/articles/how-codex-runs-a-harness-stage/

## First comment

OpenSpec Workbench code and issues: https://github.com/VeryComplexAndLongName/OpenSpec-UI
