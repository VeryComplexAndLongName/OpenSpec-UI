# LinkedIn post: a new agent, and nothing else moved

## Post

Adding a tenth agent should be boring. Here it was, except for one thing nobody could have read in the documentation.

I added DeepSeek to OpenSpec Workbench over the Agent Client Protocol: one new file in the shared core, no change to either host, because both already read the same registry. That part matched the architecture exactly.

Running it live found what reading it never would have:

- On Node 22.11, `dsh` exits with code 0 before answering. Silently. This repository pins that exact Node version for its own tooling, and it lands first on the PATH of anything it starts, including an agent. The same run on Node 24.18 completed.
- It reports no usage at all: no cost, no tokens. A spending ceiling over it counts nothing and cannot fire.

"ACP connection closed" is not a sentence anyone can act on, so a run that ends that way now says which Node it met.

The write-up, with the diagram and where each claim comes from: https://openspec-ui.dev/articles/a-new-agent-and-nothing-else-moved/

Has a dependency ever exited silently on the wrong runtime version, and cost you an hour before you thought to check?

## First comment

The code, the issues and the extension: https://github.com/VeryComplexAndLongName/OpenSpec-UI
(The product is OpenSpec Workbench. The repository and packages are still called OpenSpec-UI.)

---

## Not for posting

Everything below the line stays out of the post and the comment.

### When, and what to attach

Publish on 2026-10-05: a few days after the site page (2026-10-01), not the same day.
Attach: `docs/articles/site/a-new-agent-and-nothing-else-moved/diagram.png`.
Put the repository link in the first comment, not in the post.

### Where each claim comes from

- The adapter, the live findings and the Node 22.11 exit:
  `packages/core/src/agents/deepseek-acp.ts`.
- The decision and what was left out: the archived change,
  `openspec/changes/archive/2026-09-22-deepseek-joins-as-an-acp-agent/proposal.md`.
- The article itself: `docs/articles/site/2026-10-01-a-new-agent-and-nothing-else-moved.md`.
