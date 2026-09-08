---
"@openspec-ui/core": patch
---

A cancelled agent run no longer leaves a timer armed. `spawnAndStream`
armed a ten-second kill-confirmation timer on abort and never cleared it,
so on the ordinary path — the child dies, `cancelled` is yielded, the
stream ends — the timer stayed pending, holding the Node event loop open
and firing into a queue nothing was reading. A cancelled CLI run could
take up to ten seconds longer to exit than it should.
