---
"@openspec-ui/core": minor
"@openspec-ui/cli": minor
"@openspec-ui/server": patch
"openspec-ui-vscode": patch
---

An agent says what it is doing.

A hung agent renews its workspace lease exactly as a working one does, and
its process still answers to a liveness check — the missing signal was
never liveness, it was progress. Every run now writes its own status file
into a directory shared by every working directory of a repository and
outside all of them, so removing one never takes the record with it. It is
named by the run's own identifier, never by a person, because one person
routinely runs two agents at once; the identifier is repeated inside the
file, so a record found under the wrong name is reported rather than read
as that run's.

A status is renewed on the workspace lease's own interval and reads as gone
past the lease's own staleness window — one meaning of "gone", not two. It
reports how long it has been since a run last said what it was doing, and
never whether that run is stuck, hung, or unhealthy: a long turn and a hang
produce the same silence, and telling them apart stays a person's judgement.

Every run keeps one — started from the terminal, the standalone app or VS
Code, a single stage or a whole chain — and neither the run nor its events
wait for it. What it says is the chain's stage, the last complete line an
agent wrote, or the tool it is running (`Bash: npm test`); streamed output
rewrites the file at most once a second. `openspec-ui-cli status` prints
every run of a repository — who, where, doing what, since when — and exits
`0` whether or not anything is running, the same reasoning `ready` and
`lease` already use.
