---
"@openspec-ui/core": minor
"@openspec-ui/server": minor
"@openspec-ui/webui": minor
"openspec-ui-vscode": patch
---

Read back what the verifying stages found, and what is waiting on a
person.

The audit log has recorded `checksRan` and `checksFailed` since
verify-records-what-it-found and nothing read them. They now appear per
agent beside what runs cost — an agent that is cheap and fails its checks
is not the cheap one. Measured on this repository first: 0 of 108 entries
carry the fields, because no chain has verified since the recording
landed, so the surface says which nothing that is rather than showing a
blank.

Unticked human-only items are readable in the standalone shell too. A
change waiting on a live check and a change nobody has started are the
same row in a list of changes — a question this repository was actually
asked, about six changes that were finished. The collecting moved into
`core`, so both hosts read one answer instead of one host walking the
files itself.

Also here, from automating a human-only check: a scheduled run firing
while another tab was open consumed its entry and displayed nothing, and
the first schedule read ran before the workspace's changes were known and
deleted every entry as belonging to a deleted change.
