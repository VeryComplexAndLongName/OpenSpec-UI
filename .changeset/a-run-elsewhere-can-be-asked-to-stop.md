---
"@openspec-ui/core": minor
"@openspec-ui/cli": minor
"@openspec-ui/server": minor
"openspec-ui-vscode": minor
"@openspec-ui/webui": minor
---

A run in another worktree can be asked to stop, through ADR 0028's signed channel.

- A request to stop is a file of its own in `.agent-messages`, beside the status and roster directories and inside no working directory. `askRunToStop` seals it with the asker's machine key. `readStopRequests` opens each envelope before parsing it, and gives a run each request addressed to it either to act on or refused as unverified, stale or already read. A request that does not check out is attributed to no run; `openspec-ui-cli status` reports it by file name.
- A run reads its requests at each renewal of its status record. A verified, fresh and new request stops it where its work is sound, as a card's Stop would: the host's `onStopRequested` calls `requestStop` with the enrolled person as `by`, and a chain's ending entry carries the request's `messageId`. A refused request is said once in the run's activity and recorded as an audit message. The server's socket runs, the delegated item run, the CLI's run and the extension's runs all read requests, and the sweep removes request files long past their window.
- `openspec-ui-cli stop <instanceId> --reason <text>` asks a live run to stop and prints the message id.
- A Pipeline card offers Stop on a run held elsewhere only when its verified record is signed by the person this host's key is enrolled as. It then says it is waiting for the run to read the request, and later that the run has not. Any other run held elsewhere states whose it is, or that it is not verified. The standalone server answers `POST /api/runs/ask-to-stop`, and the editor's Pipeline panel `openspec-ui/ask-to-stop`; both ask only a run they read as live.
