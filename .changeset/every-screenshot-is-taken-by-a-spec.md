---
"@openspec-ui/server": patch
---

Seven standalone documentation pictures are now captured from the running
application by `e2e/documentation-screenshots.spec.ts` instead of being
taken by hand, and a repository check refuses any documentation picture
that neither a capture writes nor a dated list accounts for.
