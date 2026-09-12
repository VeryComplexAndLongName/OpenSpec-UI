---
"@openspec-ui/core": minor
"@openspec-ui/server": minor
"@openspec-ui/webui": minor
---

A Pipeline tab: every active change in the order it declares, what is
running right now and whose run it is, and what can be started alongside
what.

The placement is derived in core from the readiness report, coordinates
and all, so the tab and `openspec-ui-cli ready` cannot disagree and
nothing in the view is measured. A declared blocker is drawn as a
relation; a collision is not, because a collision is not an order. A
cycle of blockers is named rather than placed.

The readiness report now carries the blockers each change declares, and
its shape and wording moved to a browser-safe leaf so both surfaces
describe a collision in the same words.
