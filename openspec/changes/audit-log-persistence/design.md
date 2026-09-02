## Context

See `proposal.md`. Facts read from the code:

- `FileAuditLog.record()` is fire-and-forget: it builds one JSON line and
  calls `appendFile(...).catch(err => console.error(...))`. It returns
  `void`, matching `AuditLog`'s interface, and never blocks a run.
- `InMemoryAuditLog` exposes `readonly entries: AuditEntry[]`.
  `FileAuditLog` exposes no read at all.
- `default-runners.ts:72` picks between them:
  `config.auditLog ?? new InMemoryAuditLog()`.
- `HarnessChainRunner`'s `listAuditEntries?: () => AuditEntry[] |
  Promise<AuditEntry[]>` is optional, and absent means no budget
  enforcement — the existing "degrade rather than fail" path.
- `checkpoint-storage-split` established, three days ago, that an
  unbounded file this project writes on every event reaches hundreds of
  megabytes.

## Goals / Non-Goals

**Goals:**

- Entries survive a host restart, in both delivery targets.
- The file is bounded.
- Persisted entries can be read back, so the budget counts a change's
  history rather than one session's.

**Non-Goals:**

- Changing `AuditEntry`, what is recorded, the report, or the budget's
  logic.
- Showing the history in any UI.
- Making the audit log a general query surface.

## Decisions

### JSONL stays; the file gains a bound

`FileAuditLog` keeps appending one JSON object per line, and gains a size
or age bound with rotation.

**Rejected alternative**: leave it unbounded and rely on the entries being
small. Rejected on this project's own recent evidence: a per-event write
with no bound produced a 356.6 MB file within days. An audit line is
hundreds of bytes rather than twenty megabytes, so the ceiling is further
away — not absent.

**Rejected alternative**: replace JSONL with a database. Rejected — append
one line per event is exactly the access pattern JSONL suits, the
alternative adds a dependency this project's posture rejects (ADR 0013
declined one over a ~20 MB binary), and the read side needs no queries
beyond "entries for this change".

### Rotation preserves the newest, and drops the oldest

When the bound is exceeded, the oldest entries go.

**Rejected alternative**: truncate the file entirely on overflow.
Rejected — the budget sums a change's recorded usage, so discarding
everything at a threshold would silently hand a change a fresh ceiling at
an arbitrary moment. Dropping oldest-first degrades the number gradually
and in a direction that under-counts rather than over-counts, which is
the safe direction for a spending cap.

### Reading is a separate operation, and failure to read is not failure to run

A read that cannot parse a line skips it rather than failing the caller,
and a read of a missing file yields no entries.

**Rejected alternative**: fail loudly on a malformed line. Rejected —
`record()` is fire-and-forget and can be interrupted mid-write, so a torn
final line is an expected state, not corruption. The budget's own
dependency is already optional and already degrades to "no enforcement";
a parse error must land in that same degradation rather than stopping a
run.

### The write path stays fire-and-forget

`record()` continues to return `void` and to swallow its own errors into
`console.error`.

**Rejected alternative**: make it awaitable so a caller knows the entry
landed. Rejected — it is called from inside run lifecycles that must not
block on disk, and its existing interface is what every call site is
written against. A caller that needs certainty does not exist yet, and
inventing one to justify the change would be building for a hypothetical.

### Both hosts construct it, rather than core defaulting to it

`default-runners.ts` keeps `config.auditLog ?? new InMemoryAuditLog()`;
the hosts pass a `FileAuditLog`.

**Rejected alternative**: change the default in `default-runners.ts` to a
file log. Rejected — core does not know where a workspace's state
directory is without being told, and the in-memory default is what every
existing test relies on. Changing the default would make every test that
constructs runners start writing files.

## Risks / Trade-offs

- **[Risk]** Two hosts can run against the same workspace and append to
  the same file concurrently. → **Mitigation**: single-line appends to a
  file opened in append mode are the case POSIX and Windows both handle
  without interleaving for small writes; and ADR 0010's workspace lease
  already serializes the mutating work these entries describe.
- **[Risk]** Rotation loses history the budget was counting, so a ceiling
  can effectively rise. → **Mitigation**: dropping oldest-first means the
  loss is gradual and under-counts; and the bound must be set high enough
  that a change's own runs are never the thing rotated away. The tasks
  require that number to be justified, not picked.
- **[Trade-off]** The audit file is another thing in `.openspec-ui/` that
  grows. Accepted, and bounded — which is more than was true of the
  journal three days ago.

## Migration Plan

Additive. A workspace with no audit file starts one; entries recorded
before this change were never persisted and cannot be recovered, which
this change states rather than papers over. No existing configuration
changes meaning.

## Open Questions

- The exact bound and its unit (lines, bytes, or days). The tasks require
  it to be argued from the size of a real entry rather than chosen for
  looking round.
