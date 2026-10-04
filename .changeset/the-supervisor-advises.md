---
"@openspec-ui/core": minor
"@openspec-ui/webui": minor
"@openspec-ui/server": minor
"@openspec-ui/cli": minor
"openspec-ui-vscode": minor
---

A failed run says what is known about why, and the supervisor points out
runs that need you. When a run fails, its reason and the end of what it
printed are matched against causes that have been seen: the agent is not
installed, not signed in, blocked by the machine, cannot reach the
network, was rate-limited, or the service failed. The diagnosis says
whether repeating can help, quotes the line it was found in, and says what
to do instead. It is shown beneath the failure in both hosts, on the
change's card and in `openspec-ui-cli run`.

The supervisor (`supervisor.mode`, `advise` by default) adds three
suggestions beside the others in the Pipeline and in `openspec-ui-cli
advise`: a run that has said nothing new for longer than
`supervisor.silentAfterSeconds` (600), a run that has waited on a person
for longer than `supervisor.waitingAfterSeconds` (60), and a change whose
last run failed for a cause repeating cannot fix. It suggests and changes
nothing. Set it to Off from either Harness Settings view.
