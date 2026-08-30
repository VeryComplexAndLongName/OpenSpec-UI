---
"@openspec-ui/webui": minor
---

`ChangesList`/`ArchiveList` now render inside a height-bounded, scrollable
container — so the search box no longer scrolls out of view on long
lists — and switch to windowed DOM rendering above 50 items, keeping the
live DOM node count bounded regardless of how many changes a repository
has archived.
