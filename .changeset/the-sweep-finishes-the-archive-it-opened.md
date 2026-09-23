---
"@openspec-ui/core": patch
"@openspec-ui/server": patch
"openspec-ui-vscode": patch
---

The sweep finishes the archive pull request it opened. It used to follow
one only while there was still something to archive, and the check that
keeps an ordinary pass offline stood above the loop that does the
following - so once a pull request's changes had been archived by another,
no later pass ever looked at it again. One sat open for an hour with every
check green.

A pass with nothing to archive now still follows an archive pull request
of its own. Whether one may be open is read offline, from the refs a
pruning fetch left behind: where no `archive-landed-*` branch is on the
server, the forge is asked nothing, exactly as before.

One archive pass at a time also runs over a workspace on a machine, held
by the advisory claim this product already uses for resources a machine
has one of. Two hosts sweeping the same workspace had opened two archive
pull requests for the same changes 43 seconds apart, each having read the
forge before the other pushed. A pass that cannot take the claim leaves
the archive alone and says who is archiving.
