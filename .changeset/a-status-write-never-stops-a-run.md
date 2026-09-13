---
"@openspec-ui/core": patch
---

A status write never stops a run.

On Windows a run could die from its own status record: the heartbeat renewed the record from a timer with nothing handling a failure, two writes could rename onto the record at once, and a rename refused with `EPERM` escaped as an unhandled rejection that ended the process — `openspec-ui-cli run` exited 1 about fifteen seconds into a stage. The writer now takes its writes one at a time, asks again for a short while when a rename is refused because the name is in use instead of removing the record to make room, drops a write that still cannot land while the previous record stands, and waits for a write under way before removing the record on a clean end. Only the first record's failure reaches a caller, as before; nothing after it can end the run.
