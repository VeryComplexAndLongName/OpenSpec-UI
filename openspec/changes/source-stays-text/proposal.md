# Source files stay text

## Why

`packages/core/src/change-cost-report.ts` contains a raw NUL byte. It is
inside a template literal used to build a composite key:

```ts
const keyOf = (entry: AuditEntry): string => `${entry.runId}\x00${entry.stage ?? ""}`;
```

The intent was the two-character escape. What landed was the byte itself,
almost certainly from a shell heredoc — the same mechanism that collapsed
`\n` into real newlines several times while this repository was being
worked on today.

It compiles and it works: the runtime value is the same separator either
way. What it breaks is every text tool. `grep` classifies the file as
binary and silently skips it, so a search across the codebase returns
"Binary file matches" instead of the line, and a search for a term inside
that file returns nothing at all. A file that quietly drops out of every
search is a file nobody can review.

Found while looking at something else, which is how a defect that no
check reports gets found.

## Capabilities

### Modified

- The composite key is written as an escape rather than a byte.

### New

- A check that no tracked source file carries a raw control byte.

## Out of scope

Whether the key should use a separator at all. It works and its collision
argument is sound; this is about how it is written, not what it does.
