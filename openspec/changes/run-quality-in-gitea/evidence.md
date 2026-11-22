# Verification evidence

Local scoped checks on Node 24.21.0:

- node --test scripts/gitea-ci.test.mjs scripts/review-dependency-diff.test.mjs: 9 passed after adding runner boundary refusal coverage.
- ESLint on those two tests and their two implementations: passed.
- YAML parser and actual-workflow policy test: passed.
- openspec validate run-quality-in-gitea --strict --no-interactive: passed.

Full product, extension, browser and accessibility results remain pending Gitea.
No complete verification suite ran locally. No registry or deployment write ran.

Dedicated owner-scoped runner id 24 is online. Gitea job 8857 uses openspec-ci; live Docker inspection shows no bind mounts, no privileged mode, 6 GiB memory and 2 CPUs. Production credentials and the Docker socket are absent from the job.

Run 6713 reached every application check but the native job timed out before launching VS Code: test-electron's streaming download stalled on the official 395 MB distribution. Added bounded curl, Microsoft SHA-256 verification and exact editor caching. Seven selected policy/metadata tests and changed-file ESLint passed. Native integration is still pending replacement CI; this is not a passing native result.

The single curl download also received only 3.3 MB in 240 seconds, whereas bounded 1 MiB range probes returned complete 206 responses in 4-13 seconds on the same official CDN. Switched to twelve bounded 1 MiB range readers, exact Content-Range/body-length refusal and final Microsoft SHA-256 verification. Eight scoped tests passed. Cache-server activation is handled by the migration runner configuration; full native execution remains required.
