## Why

`packages/webui/scripts/build-metro-icons.test.mjs` checks that the shipped
icon stylesheet module is what its build script produces. On Windows it
has failed on every checkout. Every test run here reported it, and every
record since has said "the one failure is build-metro-icons, which fails
the same way on untouched main".

The owner asked on 2026-09-22 whether it could be turned off on Windows.
The cause is smaller than that. git on Windows checks the generated module
out with CRLF line endings, the script produces LF, and the check compares
bytes. With the carriage returns removed, the two are equal (checked the
same day). Turning the check off would leave a real mismatch unseen on the
one platform the product is developed on.

## What Changes

- The check compares the shipped module with the script's output with
  line endings made alike. Everything else about it is unchanged: any
  other difference still fails it, on every platform.

## Capabilities

### New Capabilities

(none)

### Modified Capabilities

- `quality-gates` - a check of a generated file compares line endings
  alike.

## Impact

- `packages/webui/scripts/build-metro-icons.test.mjs`.

## Explicitly out of scope

- **`.gitattributes`.** Forcing LF on checkout for generated files would
  also fix it, but it changes every contributor's checkout for one test's
  sake.
