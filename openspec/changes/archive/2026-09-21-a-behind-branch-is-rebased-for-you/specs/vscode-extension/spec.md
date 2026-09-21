## MODIFIED Requirements

### Requirement: The editor says what the workspace left behind, and sweeps on its own

The extension SHALL read what the workspace left behind when it activates
and again on the interval core settles, clearing what the product itself
left and reporting the rest in the Changes view.

The editor is where a workspace is usually open all day, so it is where a
directory left behind is most likely to be seen - and where it was seen, as
two changes with no tasks, on 2026-09-18.

What it reports SHALL be the same reading the standalone shell shows, from
the same core function. Removing a leftover SHALL be a command the person
runs; removing a working directory that is finished with SHALL be part of
the sweep, and the view SHALL say what was removed and why.

That reverses the earlier rule, under which both were commands. Six
working directories accumulated in one day on this machine, because a
press nobody remembers is a press nobody makes. The rails that made the
old rule cautious are unchanged - a clean tree, no run recorded, and a
branch that was pushed and whose remote is gone - and past them nothing
is lost: the branch stays, its commits stay, and the directory is one
`git worktree add` from existing again.

The same sweep SHALL rebase a change's branch that has fallen behind and
push it with a lease, where its configuration allows it (ADR 0034). What
it did SHALL be said in the output channel, and a conflict - the one
outcome a person has to act on - SHALL also be raised as a warning.

#### Scenario: Activation clears an archived change's leavings

- **WHEN** the extension activates in a workspace holding a directory whose
  change is archived and which holds only files the product writes
- **THEN** the directory is removed and the Changes view says what was
  cleared

#### Scenario: What it will not clear

- **WHEN** the workspace holds a directory with no documents and no archived
  change of that name
- **THEN** the Changes view reports it, and it is removed only by the
  command

#### Scenario: A sweep that fails

- **WHEN** the sweep cannot remove what it found
- **THEN** the Changes view reports the failure and the extension carries on

#### Scenario: A working directory whose work has landed

- **WHEN** the sweep finds a working directory that is finished with
- **THEN** it is removed without being asked for, and the Changes view
  says which directory went and why

#### Scenario: A behind branch that conflicts

- **WHEN** the sweep tries to rebase a change branch and it conflicts
- **THEN** the branch is left as it was, and the editor raises a warning
  naming the branch and the files in conflict
