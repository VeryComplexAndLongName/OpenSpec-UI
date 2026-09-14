---
"@openspec-ui/core": minor
"@openspec-ui/cli": minor
"@openspec-ui/server": minor
"openspec-ui-vscode": minor
"@openspec-ui/webui": minor
---

A run is signed by its person. Each person gets an Ed25519 key per machine, made on first need under `~/.openspec-ui/identity`. A run seals its status record's exact bytes with that key, and a reader verifies them before it parses anything. Every record reads as one of three states: verified (signed by an enrolled person), unverified, or does not check out. A record that does not check out shows nothing from its contents, and the sweep keeps it.

A key that signs a live run and is not enrolled waits in the Human-Only Inbox of both hosts with "It was me". It is also listed by `openspec-ui-cli enrol`. `status` and the Pipeline's run lines say whose a run is, as far as its signature shows.
