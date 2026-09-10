# quality-gates Specification

## Purpose
TBD - created by archiving change browser-e2e-accessibility. Update Purpose after archive.
## Requirements
### Requirement: Standalone browser journeys are release-gated

The system SHALL execute the built standalone application in a managed
Chromium browser for every pull request and main-branch update,
covering not only editing artifacts but a real mutating-agent-run
lifecycle: in-order event delivery, an interrupted run's recovery and
rollback, and cross-host mutation contention.

#### Scenario: Change Editor journey succeeds in a real browser

- **WHEN** the browser opens an authenticated standalone server for a valid workspace
- **THEN** the React workbench loads without uncaught page errors
- **AND** the user can load, edit, and save a change artifact

#### Scenario: A mutating run's events render in the order they occurred

- **WHEN** a user starts an `implement` run from the AI panel
- **THEN** every event the agent produced appears in the run's event log
  in the same order it was produced, ending in a terminal state

#### Scenario: A dropped connection during a run does not crash the page

- **WHEN** the WebSocket connection is severed while a run is in progress
- **THEN** the page reports no uncaught error and simply stops receiving
  further events for that run

#### Scenario: A server stopped mid-run has no record of that run on restart

- **WHEN** the standalone server process is stopped while a mutating run
  is in progress, and a new server is started against the same
  workspace
- **THEN** the Processes list shows no entry for that run

#### Scenario: An interrupted run's recovery and rollback are reviewable in the browser

- **WHEN** a workspace's persisted journal contains a run left
  interrupted with a finalized checkpoint delta
- **THEN** the Processes and Recovery tab shows its interrupted state and
  changed files
- **AND** rolling it back restores the affected files and reports the
  result

#### Scenario: A second host's mutating run is blocked by an active workspace lease

- **WHEN** two standalone servers are open on the same workspace and one
  already holds the workspace's mutation lease with an active run
- **THEN** the other server's `implement` attempt is shown as failed in
  its AI panel, naming the host currently holding the workspace

### Requirement: Serious accessibility regressions fail CI
The system SHALL scan the stable standalone workbench state using an established
accessibility engine.

#### Scenario: Browser state contains a serious accessibility violation
- **WHEN** the automated accessibility scan reports a serious or critical violation
- **THEN** the browser quality job fails with violation details

#### Scenario: Browser journey fails
- **WHEN** the browser journey does not complete
- **THEN** CI retains diagnostic artifacts for investigation

### Requirement: New repository-authored text follows the English policy
The system SHALL fail the normal lint gate when a tracked authored file contains
new or modified unapproved Cyrillic text.

#### Scenario: Tracked source contains Cyrillic text
- **WHEN** a tracked Markdown, source, JSON, or YAML file contains Cyrillic text
- **AND** its path and normalized content do not match the reviewed legacy baseline
- **THEN** the lint gate fails with file and line diagnostics

#### Scenario: Reviewed legacy line remains unchanged
- **WHEN** a tracked line matches its reviewed baseline path and content hash
- **THEN** the scanner reports no new policy violation

#### Scenario: Intentional internationalization fixture is marked
- **WHEN** a fixture line contains Cyrillic text and an explicit policy marker
- **THEN** the scanner accepts that line

#### Scenario: Real CLI output fixture contains repository prose as data
- **WHEN** the scanner encounters the explicitly exempt captured CLI JSON fixture
- **THEN** it leaves the fixture byte-for-byte unchanged

#### Scenario: Generated files exist locally
- **WHEN** ignored build, dependency, or editor-test output contains Cyrillic text
- **THEN** the tracked-file scanner does not inspect that output

### Requirement: A check whose cost varies with the machine states its own budget

Where a check's duration depends on how busy the machine is — because it
does filesystem work, spawns processes, or builds fixtures — it SHALL
carry a time budget chosen from a measurement of that check, and SHALL
NOT rely on the default budget intended for fixed-cost unit tests.

The measurement the budget was chosen from SHALL be recorded with it, so
a later failure can be told from a budget that was never justified.

A budget SHALL be raised only where the check has been established to be
slow rather than stalled. Where a check makes no progress, the system
SHALL treat that as a defect to diagnose rather than a budget to widen.

#### Scenario: The machine is busy

- **WHEN** the suite runs while other work occupies the machine
- **THEN** a check whose cost varies still completes within its budget,
  and reports on the behaviour it asserts

#### Scenario: A check stalls rather than slows

- **WHEN** a check makes no progress rather than running slowly
- **THEN** widening its budget is not the remedy, and the stall is
  diagnosed

#### Scenario: The behaviour under test regresses

- **WHEN** what a check asserts is actually violated
- **THEN** it fails on that, not on time

### Requirement: A check whose cost grows with the repository carries its own budget

Where a check's work grows with the size of the repository — reading
every file of a kind, rather than a fixed set — it SHALL be given a time
budget chosen for that growth, and SHALL NOT rely on the default budget
intended for fixed-cost unit tests.

The budget SHALL be recorded alongside the measurement it was chosen
from, so that a later failure can be told apart from a budget that was
never justified.

Such a check SHALL fail only on the behaviour it asserts, and SHALL NOT
fail because the repository has grown since the budget was set.

#### Scenario: The repository grows

- **WHEN** files of the kind the check reads are added
- **THEN** the check still completes within its budget and reports on the
  behaviour it asserts

#### Scenario: The check runs alongside the rest of the suite

- **WHEN** the check runs under full-suite load rather than alone
- **THEN** its budget still accommodates it

#### Scenario: The behaviour under test regresses

- **WHEN** what the check asserts is actually violated
- **THEN** it fails on that, not on time

### Requirement: The time-budget rule is enforced by a check, not by memory

Where the repository requires a cost-varying check to state its own time
budget, that requirement SHALL be verified mechanically as part of the
lint gate, rather than relying on an author remembering it.

The verification SHALL name the file it rejects and say what is missing,
so the author can act on it without reading the spec first.

A check that matches the mechanical signal but is genuinely fixed-cost
SHALL be recorded as an explicit exemption with a stated reason, rather
than being made to carry a budget it does not need or silencing the
verification for everything.

#### Scenario: A new cost-varying check omits its budget

- **WHEN** a test that does filesystem work, spawns a process, or builds
  fixtures is added without a stated time budget
- **THEN** the lint gate fails and names that file

#### Scenario: A fixed-cost check matches the signal

- **WHEN** a check matches the mechanical signal but its cost does not
  vary with the machine
- **THEN** it is recorded as an exemption with a reason, and the lint
  gate passes

#### Scenario: The rule is met

- **WHEN** every cost-varying check states a budget or is a recorded
  exemption
- **THEN** the lint gate passes and reports nothing

### Requirement: A change may state what must land before it starts

A change SHALL be able to state which changes must land before it can
start, as a relation distinct from the historical one it may also state.

The two SHALL be kept apart because they behave differently: a
historical relation is permanent, while a blocking one is resolved when
the change it names is archived. A reader SHALL be able to tell, from the
relation alone, whether a change is waiting on another or merely grew out
of it.

A blocking relation naming a change that does not exist SHALL fail the
same gate that verifies the historical relations, and a cycle among
blocking relations SHALL fail it too — no ordering of the changes can
satisfy one.

A blocking relation whose named change is still active SHALL NOT fail
anything. It states a plan, and a plan not yet carried out is not a
defect; a surface presenting the graph reports it instead.

#### Scenario: A change is waiting on another

- **WHEN** a change states that another must land before it starts, and
  that change is still active
- **THEN** the gate passes, and the relation is reported as an unmet
  blocker rather than as an error

#### Scenario: The blocker has been archived

- **WHEN** the change named as a blocker has been archived
- **THEN** the relation resolves, because archiving is what lands a
  change

#### Scenario: A blocking relation names nothing

- **WHEN** a blocking relation names a change that does not exist
- **THEN** the gate fails, naming the change and the id

#### Scenario: Blocking relations form a cycle

- **WHEN** blocking relations form a cycle among two or more changes
- **THEN** the gate fails and names the changes in it

### Requirement: The relation gate runs without a build

The check that verifies stated relations SHALL run from source, without
requiring any package to be built first.

A gate that depends on a build step becomes unavailable exactly when it
is most useful — on a fresh checkout, and before the change that would
fix the build. The reader it uses SHALL be the same one the editor
surfaces use, so that a relation cannot be valid to one and invalid to
the other.

#### Scenario: A fresh checkout

- **WHEN** the checks are run on a checkout where nothing has been built
- **THEN** the relation gate runs and reports on the repository's own
  changes

#### Scenario: One reader

- **WHEN** an editor surface and the gate both read the same stated
  relation
- **THEN** they agree, because they read it through the same code

### Requirement: A stated relation between changes is verified, not trusted

Where a change states that it follows from, or supersedes, another
change, that statement SHALL be recorded in a form a check can read, and
SHALL be verified as part of the lint gate.

A stated relation naming a change that does not exist SHALL fail the
gate, whether the named change is expected to be active or archived. A
successor that was named but never created is the failure this guards
against, and it SHALL not be discoverable only by someone later reading
prose.

A set of stated relations that forms a cycle SHALL fail the gate, since
no ordering of the changes can satisfy it.

The verification SHALL name the change and the unresolved id, so the
author can act on it without opening the metadata.

#### Scenario: A named successor does not exist

- **WHEN** a change states that it follows or supersedes a change id that
  matches no active or archived change
- **THEN** the lint gate fails, naming both the change and the id

#### Scenario: The named change is archived

- **WHEN** a stated relation names a change that has since been archived
- **THEN** it resolves, because archiving is not deletion, and the gate
  passes

#### Scenario: The relations form a cycle

- **WHEN** stated relations form a cycle among two or more changes
- **THEN** the lint gate fails and names the changes in it

#### Scenario: A change states no relation

- **WHEN** a change states neither relation
- **THEN** the gate passes: the relation is optional, and an absent edge
  is not an error

### Requirement: A named successor is a real one

Where a change's tasks state that a successor change was created, a check
SHALL verify that a change exists which states it follows that change.

Naming a successor in prose and creating none is how work that was
honestly reported as unresolved loses its owner. The stated relation is
already verified; the prose that promises one is not, and it is the form
the failure has actually taken here.

The check SHALL state what wording it looked for, so that a change
phrasing it differently is a known gap rather than a silent pass.

#### Scenario: A successor is named and exists

- **WHEN** a change's tasks name a successor, and a change states that it
  follows that change
- **THEN** the check passes

#### Scenario: A successor is named and does not exist

- **WHEN** a change's tasks name a successor and no change states that it
  follows that change
- **THEN** the check fails, naming the change and the successor it named

### Requirement: A spec delta is checked against the spec it modifies

A change that states it modifies a requirement SHALL be checked, before
it is archived, against the specification it modifies.

A modified block whose requirement header no longer exists, or which
omits a scenario the current specification carries, SHALL fail. Archiving
already refuses both, but it refuses at the end — after the work is
finished and reviewed — and the drift is not the author's doing: it comes
from another change landing in between.

#### Scenario: The requirement was renamed since the change was written

- **WHEN** a modified block names a requirement header the specification
  no longer carries
- **THEN** the check fails, naming the header and the specification

#### Scenario: A scenario was added since the change was written

- **WHEN** the specification carries a scenario the modified block omits
- **THEN** the check fails, naming the scenario that would be dropped

#### Scenario: The delta still matches

- **WHEN** a modified block matches the specification it modifies
- **THEN** the check passes, and archiving is not the first place this
  was known

### Requirement: Tracked source files carry no raw control bytes

A tracked source file SHALL NOT contain a raw control byte. A control
character intended as a value SHALL be written as an escape sequence.

A file carrying one is classified as binary by `grep` and by the tools
built on it, so it silently drops out of every search across the
codebase — the file returns nothing for a term it contains, and a search
that should have found it reports a match it cannot show. A file nobody's
search can reach is a file nobody reviews.

#### Scenario: A source file with a raw control byte

- **WHEN** a tracked source file contains a byte below 0x09, or between
  0x0E and 0x1F
- **THEN** the check fails, naming the file and the offset

### Requirement: A passing check has checked what its name says

A repository check SHALL fail when the thing it is named for is absent
or wrong, and SHALL NOT pass on an input it did not read.

A lint that reads only one spelling of what it checks passes the other
spellings unread; a test that asserts one value appears passes a chart
drawn entirely wrong; a fixture that borrows the developer's
configuration passes on one machine and fails on another for a reason
unrelated to the code. Each is a green result that reports nothing.

The changeset lint SHALL read every form a package name may take in a
changeset's frontmatter, and SHALL refuse a line it cannot read.

A test named for a shape SHALL assert that shape.

A fixture that runs a tool SHALL isolate that tool from configuration
outside the repository.

#### Scenario: A changeset with an unquoted name

- **WHEN** a changeset names a package without quotes, misspelled
- **THEN** the lint fails, naming the file and the name

#### Scenario: A chart drawn wrong

- **WHEN** the per-day chart draws every bar as zero over a history with
  archives
- **THEN** the browser test named for that history fails

#### Scenario: A developer with commit signing on

- **WHEN** the dated-workspace fixture runs on a machine whose global
  git configuration requires signed commits
- **THEN** the fixture commits, and the test runs

