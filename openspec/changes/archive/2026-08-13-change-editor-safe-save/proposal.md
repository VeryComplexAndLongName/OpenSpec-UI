## Why

The Change Editor currently writes four markdown artifacts independently. A
filesystem failure can leave a partially updated change, and an external edit
made after the document was loaded can be overwritten without warning.

## What Changes

- Move Change Editor file reads and writes into a host-neutral core service.
- Return a content revision when loading editable artifacts.
- Reject saves whose expected revision no longer matches disk state.
- Stage all files and restore the original set when replacement fails.
- Surface conflicts in the standalone editor without discarding local edits.

## Impact

- `packages/core`: transactional Change Editor storage and tests.
- `packages/server`: thin read/save adapter with conflict responses.
- `packages/webui`: revision propagation and stale-edit messaging.