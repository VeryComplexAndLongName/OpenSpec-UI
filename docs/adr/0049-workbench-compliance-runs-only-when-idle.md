# 0049: Workbench Compliance Runs Only When Idle

Status: Proposed

Date: 2026-10-11

## Context

Repository rules are distributed across OpenSpec specs, agent instructions,
toolchain metadata and operational documentation. Workbench already owns safe
repository initialization, a shared core, host lifecycle signals, a mutation
lease and local runtime-state storage. A compliance feature must make its rules
discoverable without executing repository-provided instructions, and it must
not repeat the expensive, overlapping local test runs that make a machine
unusable.

The immediate observed gap is that `.openspec-ui/` runtime files can appear as
untracked changes when a repository's `.gitignore` lacks the required entry.
In HppMCP, the main checkout accumulated a run journal, audit log, run logs,
workspace lease and temporary lease files for an initialized repository whose
`.gitignore` did not ignore `.openspec-ui/`. Those records also name the actual
worktree `cwd` and `changeDir`; the file location alone is therefore not enough
to infer that a run used the wrong working directory. The same investigation
found a change id both in the active directory and the archive, plus repeated
copies of shared changes in old worktrees.
Users also reported more Pipeline cards than entries in Changes and active
changes missing from the OpenSpec README index. These observations require
separating a logical change from its physical worktree copies.

The system also has a scheduled-run mechanism, but those schedules represent a
person's requested run time and deliberately depend on the application being
open; they are not a compliance workload scheduler.

## Decision

1. **Core owns the compliance catalogue and policy.** A rule has a stable id,
   requirement source, evaluator, outcome semantics, cost class and optional
   named repair. Repository files cannot add executable rules.
2. **Initialization runs only cheap bootstrap checks.** Workbench verifies
   that `.openspec-ui/` is Git-ignored and adds only the missing managed rule
   while preserving user content. Unsafe or unreadable files produce advice.
3. **Periodic monitoring is opt-in and host-owned.** There is no detached OS
   daemon. Hosts provide idle state; core refuses work while the host is active
   or a mutating Workbench process holds the lease.
4. **Work is measured, serialized and bounded.** Core runs one check at a time,
   records bounded duration history, and schedules checks over later idle
   windows according to cost and the configured slice budget. Unknown cost is
   treated conservatively.
5. **Repairs are allowlisted and per-rule configurable.** `autorepair` is
   available only for an idempotent core-owned repair. Tracking is a separate
   switch from reaction, inherited across global/topic/rule levels. `none`
   suppresses presentation without deleting observations. `advice` may offer
   an explicit safe repair. The global background monitor defaults to disabled.
6. **User policy state stays outside the checkout.** Settings and bounded
   measurements are stored by canonical repository identity and shared among
   sibling worktrees. Findings retain short evidence, never file contents.
7. **Runtime placement is defined per artifact kind.** Run and audit logs use
   the root their writer was given; workspace journals/leases may belong to the
   host-selected checkout; status and identity state have separate roots. The
   monitor compares observed paths and recorded `cwd`/`changeDir` with that
   contract. It does not move logs or leases to make a status report look clean.
8. **Change identity is the stable change id, not a directory count.** Copies
   of one active change in multiple worktrees are grouped as one logical change.
   An id present in both active and archive trees, or untracked main-checkout
   artifacts beside an owning worktree, is advice-only and never auto-deleted.
9. **README and UI indexes are checked without being rewritten.** Active ids
   missing from the OpenSpec README index receive a suggested link. Changes and
   Pipeline observations are compared by logical identity while existing
   directory cards remain unchanged; Compliance explains copies rather than
   silently changing another view's established model.
10. **Closed-change worktrees are stale findings, not cleanup instructions.**
    Compliance reports the branch/base relationship and dirty paths when
    available, then leaves branch and worktree removal to the owner.
11. **The existing sweep remains independent.** Its observations contribute to
   the common cache, but Compliance cannot change sweep behavior or repair its
   findings. No additional sweep is started by opening Compliance.
12. **Opening is cache-only; completion is explicit.** Results and Settings share
   icon-and-text tabs opened from Changes. Lazy UI loading, scrolling and
   expansion read cached data only. Read remaining checks missing/stale
   subjects serially, with cancellation and the same resource limits.
13. **Checks yield rather than competing with the user.** Each background slice
   runs one bounded step after idle, with a minimum gap, adaptive delays and
   failure backoff. Large indivisible checks may stay deferred all session.
   Priority and async execution alone are not CPU/disk usage limits.
14. **Observation time is not change time.** Store checked and changed times
   separately. Unknown or disabled states retain known findings; only a fresh
   pass removes an active problem. Live updates preserve focus and scroll,
   and full-cache sorting includes both timestamps.

## Rejected Alternatives

### A continuously running system daemon

Rejected because it complicates installation and lifecycle, cannot reliably
know whether the user is active in either host, and continues spending resources
after the workbench closes.

### Running the whole catalogue at startup

Rejected because it adds an unpredictable delay to opening a workspace and
repeats repository-wide checks on every window. Initialization is limited to
cheap bootstrap checks; periodic work waits for idle.

### Treating every failed check as repairable

Rejected because arbitrary source edits cannot be safely inferred from a
finding. Repair requires an explicit core-owned implementation and a passing
post-repair check.

### Moving all run data out of main or deleting duplicate directories

Rejected because some runtime records are intentionally workspace-scoped, and
the observed record already says which worktree actually ran. Moving journals,
leases or audit evidence can break recovery or erase provenance; deleting a
change copy can discard uncommitted user work. Compliance names the paths and
offers advice instead. Only the managed `.gitignore` append is initially
allowlisted for automatic repair.

## Consequences

- Core contains a deterministic catalogue and planner; hosts supply idle
  observations and present its result.
- The first managed repair is narrow: make `.openspec-ui/` ignored without
  rewriting unrelated `.gitignore` content.
- Periodic checks produce no background work until a person enables them.
- Rules without a safe evaluator or repair remain visible as advice/unknown,
  rather than being silently treated as compliant.