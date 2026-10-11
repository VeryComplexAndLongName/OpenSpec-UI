# Design

## Non-Goals

Do not reschedule, disable or replace the existing workspace sweep. Do not
resolve rebase conflicts, delete worktrees, run tests or start agents from
Compliance. Do not install Metro UI globally or execute repository prose.

## Decisions

### Shared Observations, Not Another Sweep

Core owns one bounded observation cache per canonical repository identity.
Existing sweeps, surveys and supported checks contribute typed observations;
Compliance consumes them without calling `sweepWorkspace`. Sweep observations
are read-only and labelled as managed by Sweep. Their controls cannot override
sweep settings or invoke its actions. Other repairs use only named core-owned
implementations, with fresh safety checks and post-repair verification.

Each observation identifies its rule, subject, producer, repository, worktree,
change, branch and full path where applicable. It records `checkedAt` separately
from `changedAt`, the state revision and bounded evidence. Secret values and
raw logs are excluded. Missing evidence remains unchecked/unknown; read failures
and disabled tracking never resolve an existing finding. A successful check
that confirms resolution removes the problem from the active result list.

### Cache-Only Opening and Explicit Completion

Opening Compliance, changing tabs, scrolling and expanding details read only
the cache. A separate `Read remaining` action checks missing or stale subjects
sequentially, with progress and cancellation. It never invokes a full sweep,
performs repairs implicitly or removes resource limits. Closing the panel stops
the explicit queue after the current safe step. Completed results survive.

### Hierarchical Policy

Global, topic and rule settings separate tracking (`enabled`, rendered as a
switch) from reaction (`none`, `advice`, `autorepair`, rendered as a dropdown).
Topic and rule values may inherit; the UI displays the effective value and its
source. `none` suppresses presentation, not observation collection. Disabled
tracking stops new Compliance checks but retains known observations. Passive
observations from existing producers do not cause additional work.

Severity is rule metadata (`critical`, `warning`, `info`), not permission to
repair. Use a textual badge plus a restrained color marker, not color alone.
An advice rule may offer an explicit safe repair; autorepair is allowlisted.

### Low-Impact Work

Background checks default off. When enabled, they start only after host idle,
with no active mutation. One bounded subject step runs at a time; remaining
work yields to later idle windows with a minimum gap and failure backoff.
Use existing observations first and invalidate only affected subjects.
Expensive indivisible work may remain deferred for the whole session. Async
execution and process priority alone are not a CPU or disk-load guarantee.
Explicit completion retains the same serialization and per-step limits.

### Results and Settings in One Window

A shield action in the Changes horizontal toolbar opens repository-wide
Compliance, including sibling worktrees. Top tabs use icon plus text for
`Results` and `Settings`, with a compact active marker inspired by Panda's
default Tabs. Use existing React components/icons rather than adding Metro UI.
Lazy-load the window, mount Settings on first use and retain its state. Fetch
cached details on expansion and virtualize long lists. Sort/filter/count across
the entire cache, not merely loaded rows, by topic, severity, name, checked time
or changed time. Live updates preserve focus, expanded rows and scroll; defer
sort repositioning while the user interacts. No repeated popup notifications.

## Risks / Trade-offs

Cache entries can be stale; expose timestamps and freshness rather than claiming
current compliance. A host idle signal is not machine-wide CPU availability.
Budget checks stop new steps, not a process already running. Cross-host writes
need serialization and atomic persistence; a cache is never repair authority.
Existing Pipeline cards represent physical working directories: Compliance
reports logical-id consistency without silently changing that established UI.

## Transport Compatibility

Add `POST /api/compliance` for standalone and `compliance` / `compliance-result`
webview messages for the extension. Both dispatch through `dispatchCompliance`.
Operations are read, step, background, settings and repair; none invokes sweep.
Existing agent commands/events remain unchanged. REST enforces existing token
and cwd policy; extension messages use the host-owned root, never client cwd.

## Verification Evidence

Focused core, webui, REST and extension bridge tests pass on Node 24.21.0.
Core/server/webui/extension typechecks and touched-file lint pass. Standalone
and extension builds pass, with existing import.meta/CJS warnings. Live
standalone smoke in a disposable repository confirmed cache-only opening,
incremental completion and runtime-ignore repair removing its finding.
A live isolated VS Code Extension Development Host smoke passed with exit code
0 for activation, command, panel tab and disposal. Scenario mapping is recorded
in tasks.md. Broader workspace regression remains for CI; no release or archive
operation is performed by this implementation session.

## Rule Catalogue

Core owns an immutable catalogue. Every entry has a stable id, human-readable
requirement, source spec/document, evaluator, default response, cost class and
an optional named repair implementation. Checks report `pass`, `finding` or
`unknown`; lack of evidence is never reported as compliance.

The first rules cover Workbench-owned repository state: `.gitignore` ignores
`.openspec-ui/` at the main checkout and each worktree root; active changes are
indexed; an id is not present in both active and archive trees; and an
untracked main-checkout copy is reported when that change has an owning
worktree. Runtime configuration can then be compared with the supported
repository toolchain. Checks that cannot be made mechanically remain
advice-only findings rather than inferred failures.

The catalogue is code-owned and versioned with core. Repositories may select a
response for each known rule, but may not install executable check code through
repository files. Requirement prose and repository contents remain data.

## Reactions and Repair Safety

For a permitted repair, a known pre-write safety refusal falls back to Advice.
The cached observation retains its finding and stores a bounded `repairAdvice`
reason and suggested next step. The UI labels it Repair skipped - Advice and
offers an explicit Retry safe repair, which repeats all safety checks. The
user's configured reaction is not changed. Background work does not immediately
retry; a later scheduled check may refresh the evidence and reconsider safety.
Permission failures and unexpected errors, including post-write verification
failures, are not disguised as a no-mutation safety skip.

The global periodic monitor defaults to disabled. Explicit initialization still
runs its small bootstrap check. Periodic mode and each rule's response are
configurable in one per-repository user settings file outside the checkout.

`none` hides that rule's findings in the normal view but preserves observations.
Disabled tracking, a separate setting, skips new checks. `advice` records and
presents its finding. `autorepair`
is accepted only for a rule with a core-owned idempotent repair implementation;
otherwise configuration resolves to advice with a visible explanation. A
repair is limited to the named file and must preserve unrelated content. The
initial `.gitignore` repair appends the root pattern `/.openspec-ui/` only when
Git confirms it is not already ignored; it never replaces or normalizes the
file.

### Runtime and Worktree Evidence

The monitor treats runtime placement by artifact kind, not by the blanket rule
that every file belongs beside the agent's `cwd`. A workspace journal and
workspace lease can belong to the host-selected root; run/audit files follow
the root supplied to their writer; machine identity and agent status have
separate shared locations. Each rule states the expected root and reports the
observed root plus recorded `cwd`/`changeDir`. It never moves or deletes logs,
leases, journals or OpenSpec artifacts to make the finding disappear.

The identity of a change is its stable OpenSpec id. Equal ids observed in
several worktrees are grouped into one logical finding and are not, by
themselves, a violation. An id found both active and archived is a duplicate
identity finding. Untracked main-checkout change files beside an owning
worktree are reported as a shadow copy. These findings default to `advice`;
no automatic branch removal, change archival or content deletion is allowed.

Compliance compares observations by unique change id, not by the number of
worktree directories. Existing Pipeline directory cards are not rewritten by
this capability. An active change missing from a declared OpenSpec README index is reported
with a suggested link target; compliance does not edit the README. A worktree
whose change is archived/closed in the repository is reported as stale with
its branch, base relationship and dirty paths when available. It is never
removed automatically, especially when it contains uncommitted work.

The HppMCP observation is a reusable fixture: a repository without a managed
ignore rule accumulates `.openspec-ui/workbench-runs.json`, `audit.jsonl`, run
logs, leases and lease temp files in `git status`. Compliance must identify the
missing ignore rule and leave the existing evidence untouched. Adding the
managed `.gitignore` rule is the only initial auto-repair.

## Scheduling and Load

There is no detached process. Each host supplies an idle signal and asks core
for work. The monitor pauses while the host is active, a Workbench mutation is
running, or the user disables it. It evaluates one rule at a time and stops at
the configured per-idle-slice wall-time budget. A later idle window resumes
remaining work.

Rules declare a conservative cost class. Core records elapsed wall time and,
where the host supports it, process CPU time; it retains bounded recent p95
measurements per rule. Unsupported measurements remain unknown rather than
guessed. The planner prioritizes overdue cheap rules, defers expensive work
when it does not fit the remaining budget, and treats unknown measurements as
expensive. It does not sample CPU in a busy loop, spawn parallel check workers,
or run the full catalogue at startup.

## State and Presentation

User settings and bounded measurements live outside the repository, keyed by
the repository's canonical Git common directory so sibling worktrees share one
policy and history. Findings store rule id, outcome, time, short evidence and
repair result only; they do not persist source contents or command output.

Core exposes cache-only readings and separate explicit actions. The shared UI
displays freshness, checked/changed time, measured cost, evidence and available
repair actions. Hosts do not reimplement rule selection or scheduling. `Read
remaining` may read missing/stale subjects without waiting for idle but retains
resource limits and never repairs implicitly.

## Alternatives

- A permanent OS daemon was rejected: it complicates installation and lifecycle
  while the workbench already supplies the workspace and idle signals.
- Running every rule during startup was rejected: it creates unpredictable
  opening delays and repeats repository-wide work on every window.
- Auto-repairing any failed check was rejected: repair is allowed only through
  a core-owned idempotent operation named by that rule.