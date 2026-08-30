---
"@openspec-ui/webui": minor
---

`TabPanel` gains an opt-in `lazy` prop that defers a tab's first mount
until the user opens it, instead of mounting on app load; applied to all
of the standalone shell's top-level tabs, closing an eager-fetch gap
where the Processes and Recovery tab loaded its data before ever being
opened.
