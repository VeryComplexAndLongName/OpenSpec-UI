# Persistent Workbench Runs Tasks

## 1. Core persistence and safety

- [x] 1.1 Add serializable checkpoint coverage and round-trip tests in
      `packages/core/src/checkpoint.ts` and `checkpoint.test.ts`.
- [x] 1.2 Add a versioned atomic run journal with corruption and retention tests
      in `packages/core/src/workbench-run-journal.ts`.
- [x] 1.3 Change scheduler mutation isolation to workspace-wide and add tests
      for cross-change serialization and concurrent reads.
- [x] 1.4 Add interrupted process restoration to the scheduler with unit tests.

## 2. VS Code recovery adapter

- [x] 2.1 Persist scheduler snapshots and implementation checkpoints from the
      extension without storing them in VS Code global state.
- [x] 2.2 Restore process history on activation and finalize interrupted
      implementation checkpoints for explicit rollback.
- [x] 2.3 Show interrupted state and checkpoint coverage in Processes view and
      add extension tests.

## 3. Versioning and parity

- [x] 3.1 Document package-level SemVer and the standalone/VS Code capability
      matrix in repository documentation.
- [x] 3.2 Update extension release notes and bump core to 0.7.0 and extension to
      0.3.0, including lockfile workspace versions.

## 4. Verification

- [x] 4.1 Run core and extension typecheck, lint, and unit tests.
- [x] 4.2 Run workspace-wide typecheck, lint, and tests.
- [x] 4.3 Run strict OpenSpec validation for `persistent-workbench-runs`.
- [x] 4.4 Build/package the extension and run its real VS Code integration
      smoke test before archive.
