---
"@openspec-ui/core": patch
---

A mechanical check that fails at `verify` now sends the work back to
`apply` where another attempt is configured, instead of ending the chain.
This is the case the backward edge was written for — a failing check is
what unchecks the task — and it was the one case the edge could not
reach. The verifying agent is still not invoked, and a chain configuring
no extra attempts fails exactly as before, with the same message.
