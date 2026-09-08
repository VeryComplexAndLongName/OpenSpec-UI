---
"@openspec-ui/core": minor
"@openspec-ui/webui": patch
---

The three named harness configurations are titled by what a person is
actually choosing between — **Minimum cost · up to $3, 45 min**,
**Balanced · up to $5, 60 min**, **Fastest · up to $25, 4 hours** — with
the ceilings in the title rather than in a sentence below it. They were
previously named for how closely the run is watched, which is a
consequence of each choice and not the choice.

The configurations themselves are unchanged; their ceilings were measured
against this repository's audit log and that measurement stands. Their
ids change with their names (`min-cost`, `balanced`, `fastest`) — nothing
stores a template by id.

"Fastest" states what makes it fast, since nothing here makes an agent
work faster: it never waits for a person, and its ceilings are wide
enough that a stage is not cut and started over.
