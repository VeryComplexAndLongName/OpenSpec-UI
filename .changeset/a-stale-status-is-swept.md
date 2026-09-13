---
"@openspec-ui/core": minor
"@openspec-ui/cli": patch
"@openspec-ui/server": patch
---

A stale status is swept.

A run that crashed left its status record behind for good, and a write that died between writing and renaming left its temporary file; the reader walked every one of them on every poll. Core gains `sweepAgentStatuses`, separate from `readAgentStatuses`, which stays a pure reading: it removes a record whose heartbeat is past the staleness window only if it is still past it when read again immediately before removal, removes a record's temporary file once it is older than the same window, never removes a malformed record, and treats a file already gone or momentarily in use as nothing to do. It reports what it removed. The sweep runs where the directory is already being looked at — a status writer as it starts, `openspec-ui-cli status` before it reads (removals are said on stderr), and the Pipeline tab's survey — with no timer of its own. A status record's fields are pinned by a test, so it cannot quietly start keeping history that a sweep would then throw away.
