## ADDED Requirements

### Requirement: One entry starts a run, and it shows what it will do

A change SHALL be started from a single entry, in every host.

That entry SHALL show what the resolved configuration says will happen —
which path will run and which agent will run it — before the run starts.
A surface that acts on a configuration and shows nothing of what it read
leaves a person unable to tell a correct decision from a broken one; here
the two look identical, because the wrong choice mostly changes which
panel is visible.

The entry SHALL pre-select what the configuration resolves to and SHALL
allow it to be changed for this run.

An override SHALL NOT be written to the change's configuration. A run is
not a configuration change, and a later run behaving differently for a
reason nobody recorded is worse than being asked again.

There SHALL NOT be a second entry that starts the same work by another
route. Where a path was previously reached by its own entry, it SHALL be
offered as a choice within this one.

That entry SHALL also show which named configuration is recommended for
this change and the observations behind it, where anything is known to
reason from. This is the moment the question is being asked, and an
answer available only from a separate command is an answer nobody sees
when it matters.

Where nothing is known to reason from, no recommendation SHALL be shown.
A recommendation with no grounds is indistinguishable from a default
presented silently.

#### Scenario: Starting a change whose configuration is assisted

- **WHEN** a run is started for a change resolving to `assisted`
- **THEN** the entry says a single stage will run, names the agent, and
  starts that

#### Scenario: Starting a change whose configuration runs a chain

- **WHEN** a run is started for a change resolving to `semi-autonomous`
  or `autonomous`
- **THEN** the entry says a chain will run and names the agents its
  stages will use

#### Scenario: Choosing a different path for one run

- **WHEN** the offered path is changed before starting
- **THEN** that run takes the chosen path and the change's configuration
  file is left unchanged

#### Scenario: A recommendation is available

- **WHEN** the change's remaining work and previous runs are known
- **THEN** the entry names the configuration it recommends and the
  observations behind it

#### Scenario: Nothing is known to recommend from

- **WHEN** neither the remaining work nor any previous run can be read
- **THEN** no recommendation is shown

#### Scenario: The path that used to have its own entry

- **WHEN** the VS Code agent is wanted for this work
- **THEN** it is chosen inside this entry, and no separate command starts
  it
