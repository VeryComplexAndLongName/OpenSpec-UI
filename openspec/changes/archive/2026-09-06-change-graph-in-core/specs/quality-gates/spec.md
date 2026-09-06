## ADDED Requirements

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
