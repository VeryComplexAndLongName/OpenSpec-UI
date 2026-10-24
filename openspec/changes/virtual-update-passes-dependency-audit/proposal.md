## Why

PR #924 is blocked by a high-severity advisory in cheerio's transitive undici 6.x dependency. The quality-gates dependency audit must remain enabled and pass without discarding the TanStack update.

## What Changes

Refresh only vulnerable transitive undici lockfile entries to a patched compatible version.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- quality-gates: the production dependency graph passes the high-severity audit.

## Impact

package-lock.json only, alongside the existing TanStack update. No application API or protocol change.
