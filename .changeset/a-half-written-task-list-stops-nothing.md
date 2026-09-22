---
"@openspec-ui/core": patch
---

A task list caught mid-write no longer misleads a stop

Agents and editors often save `tasks.md` by emptying it and then writing
it again. A run that read the list in that moment could decide the task
it was told to stop after was missing, or mistake the next full reading
for a newly ticked task and stop too early. The list is now read again
until two readings agree, and an empty list is treated as not readable
yet.
