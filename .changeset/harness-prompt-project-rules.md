---
"@openspec-ui/core": patch
---

An Agentic Harness run's prompt now includes the project's own instructions for the artifact being worked on (`implement` -> `tasks`, via `openspec instructions <artifact> --change <id>`), in a section labelled as rules to follow, ahead of the change's own content. Previously `prepareAgentContext()` built a run's prompt from only `proposal.md`/`design.md`/`tasks.md`/`specs/*/spec.md`, so rules such as "mark each task as soon as its own verification passes" never reached an agent run through this path, even though they were reachable via the CLI. When the rules lookup fails or returns nothing, the run proceeds exactly as before. `copilot-cli`'s fallback prompt (used once the rules addition pushes prompts past its argv length threshold) now also tells the agent to run `openspec instructions tasks --change <id>` itself.
