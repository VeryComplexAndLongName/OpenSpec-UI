---
"@openspec-ui/core": patch
"openspec-ui-vscode": patch
---

The editor's Pipeline answers on a repository with hundreds of archived
changes, and the OpenSpec views no longer fail with "EMFILE: too many open
files". The Processes view read the whole workspace twice for every change
its process history named, all at once; it now reads just those changes,
once. A survey of the working directories read the archive for every task
list and took 39 seconds on this repository; it now reads each directory's
active changes once, in under a second. The Changes view reads only active
changes, the Archive view only archived ones and only when the archive
changes, and one reading of a workspace takes 16 changes at a time.
