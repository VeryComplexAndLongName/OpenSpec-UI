# Recovery after a Homepage outage

Gitea retains approved immutable release assets and publishes releases.json,
release-history.json and publications.json on the existing public release-manifest
branch. Each producer update accumulates public dated version records instead
of leaving the history file frozen at its initial manual export. Repeated
updates preserve original release dates. The Homepage five-minute discovery
reconciles the current snapshot and this history without reading product internals.

The signed publication list retains up to 1000 candidates. The producer fails
explicitly before exceeding that bound; it never silently removes older candidates.
The Homepage validates the same count and a five-million-byte document limit.
Persisted jobs, attempts and confirmations live outside the replaceable deployment.
Do not restore an old database over current receipts to recover a web process.

A worker handles one eligible registry version per invocation. The existing
CircleCI npm schedule polls every fifteen minutes and the isolated Marketplace
timer every five minutes. Both check whether the exact version already exists
before any write. An accepted upload with a lost callback is reconciled instead
of uploaded again. A delayed older npm version is published under
`recovery-MAJOR-MINOR-PATCH`, preserving the newer `latest`; a newer version
continues to use `latest`. Registry lookup failures stop the write.

Three-attempt budgets are not reset by a reboot. Exhausted failures require the
operator's Retry control, after inspecting the platform result. Uncertain
personal LinkedIn creates require recording the existing URL before any repeat.
Expired credentials must be renewed. None of these conditions justify deleting
receipts or silently declaring work published.

No CLI, extension or server runtime version changes are required for these
publication-tooling fixes. Keep the current publisher identities and credentials.
The updated Marketplace worker runtime is installed on the next successful
Homepage deployment, which remains deferred while its host is unavailable.
