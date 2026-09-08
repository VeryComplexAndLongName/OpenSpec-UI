---
"@openspec-ui/core": minor
"@openspec-ui/webui": minor
"openspec-ui-vscode": minor
---

Say what a harness configuration cannot do. A ceiling could be configured, saved,
accepted by validation and never fire — a cost ceiling over an agent that reports
no cost, a token ceiling over one whose tokens are almost all cache, or any
spending ceiling over the six agents that report nothing at all. Each is
documented in `LIMITS.md`, which is read by someone who already suspects a
problem rather than by the person setting the ceiling.

What each agent reports is now recorded in code, beside what its command line
accepts, with four states rather than two: cost and tokens, tokens only, nothing,
and never observed. The fourth keeps it honest — two ACP adapters have never been
measured here, and recording them as silent would assert something nobody
checked.

The harness settings view now lists what the configuration on screen cannot do,
updating as an agent is chosen, and a new **Explain Harness Settings** command
answers the same question for a configuration edited as JSON by hand. The finding
that matters most is a stage whose agent reports nothing and which has no time
ceiling: that stage can run without any bound at all.

Reported, never refused: an operator may knowingly leave one stage's ceiling
unable to act, and nothing here recommends a value.
