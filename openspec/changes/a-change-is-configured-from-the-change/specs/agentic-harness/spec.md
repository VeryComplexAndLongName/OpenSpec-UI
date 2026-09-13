## MODIFIED Requirements

### Requirement: The configuration is edited through the same view in every host

Every host SHALL let a person edit the harness configuration through the
same settings views, with the same pickers and the same diagnostics.

There SHALL be two views, each about one file: one for the global file, and
one for a single change's override. A view SHALL NOT edit both files.

A host that offers only the file offers none of what the settings surface
knows: which effort values the chosen agent accepts, which spending field it
honours, which custom agents the workspace defines, and which of the
configured ceilings cannot act. A person editing the file by hand is doing
the validator's work from memory.

The file SHALL remain the configuration and SHALL remain hand-editable, and
the view SHALL name it. A view that replaces a file people already edit
takes away a way of working; a view that names the file does not.

A refused write SHALL be reported where the edit was made. A form that
cannot say a save was refused is indistinguishable from one that saved.

#### Scenario: Editing the global configuration in the editor host

- **WHEN** the harness configuration is opened for editing in VS Code
- **THEN** the global view is shown, with the same pickers and diagnostics
  as in the standalone shell. It names the global file, and it shows no
  change's settings.

#### Scenario: Editing one change's configuration

- **WHEN** a change's configuration is opened for editing
- **THEN** that change's view is shown. It names the change's file, and it
  shows no global fields to edit.

#### Scenario: A save the configuration refuses

- **WHEN** a saved configuration is rejected
- **THEN** the reason is shown where the edit was made

### Requirement: Templates are offered where a per-change configuration is edited

The view of a change's configuration SHALL offer every named configuration
that may be applied to a change, not only those valid for the global file.

A template whose scope is per-change only has nowhere else to go. It is
correctly withheld from the global file, and without this view it could
not be applied at all.

#### Scenario: A per-change-only template can be applied

- **WHEN** a change's configuration is being edited
- **THEN** the named configurations available for a change are offered
  there, including those that may not be applied to the global file

### Requirement: A setting offers only values it would accept

Where a surface offers a choice of values for a setting, it SHALL offer only
the values that the same surface would accept when saved, at the scope the
control belongs to.

A value the control offers and the save refuses is worse than an absent
control. The reader makes a choice, is told it was wrong, and learns nothing
about why it was offered. The writer already refuses the value; the offer is
what has to agree with it.

Each value SHALL be named by what choosing it does. A label that describes
the implementation's history, rather than the value's effect, gives the
reader nothing to choose between, and goes stale without anyone noticing.

Where a value is withheld at one scope and accepted at another, the control
that withholds it SHALL say where it can be set.

#### Scenario: A value valid only for a change

- **WHEN** the global view offers autonomy levels
- **THEN** it offers only the levels the global file accepts

#### Scenario: The global view says where the rest is

- **WHEN** the global view offers autonomy levels
- **THEN** it says that the level valid only for a change is set in that
  change's settings

#### Scenario: The same value where it is valid

- **WHEN** a change's view offers autonomy levels
- **THEN** it offers every level a change's own file accepts

#### Scenario: What a level is called

- **WHEN** an autonomy level is offered
- **THEN** its label says what running under that level does

## ADDED Requirements

### Requirement: A change's configuration is edited from the change

A change's configuration SHALL be opened from that change: in the standalone
shell from the change's editor, and in the editor host from the change
itself.

The view SHALL know which change it edits when it first renders, and SHALL
load that change's configuration at that point. It SHALL NOT ask for the
change's name.

#### Scenario: Opened from a change

- **WHEN** a person opens the configuration of a change from that change
- **THEN** the view shows that change's configuration, loaded, and asks for
  no name

#### Scenario: Two changes at once in the editor host

- **WHEN** the configurations of two changes are opened one after the other
- **THEN** each change has a view of its own

### Requirement: A named configuration is chosen from a list and applied beside it

Where named configurations are offered, they SHALL be offered as one list
to choose from. Beside the list, the view SHALL show the chosen
configuration's effort, its purpose, what it is not for, and its basis, and
SHALL offer one control that applies it.

The recommended configuration, where there is one, SHALL be marked and
chosen first.

What applying did SHALL be said beside the control that applied it.

The settings views and the run dialog SHALL use the same list.

#### Scenario: Choosing

- **WHEN** another configuration is chosen in the list
- **THEN** its description is shown, and nothing is applied

#### Scenario: Applying in a settings view

- **WHEN** a configuration is applied in a settings view
- **THEN** the fields are filled, and the view says beside the control what
  was set and that nothing has been saved

#### Scenario: Applying in the run dialog

- **WHEN** a configuration is applied in the run dialog
- **THEN** the change's file is written, the dialog says beside the control
  which configuration was applied and to which file, and it shows what the
  change now resolves to

### Requirement: A change's settings say what they inherit

Where a change's configuration sets nothing for a setting, the change's
view SHALL say what that setting resolves to, and that the value comes from
the global file.

Choosing to inherit SHALL write nothing for that setting.

#### Scenario: A stage the change does not set

- **WHEN** a change's configuration names no agent for apply, and the global
  file names `claude-cli-acp`
- **THEN** the change's view says that apply inherits `claude-cli-acp` from
  the global file

### Requirement: A recommendation drawn from the workspace's runs can be applied

Where the run entry offers a recommendation drawn from the workspace's
runs, it SHALL offer to set the recommended agent for every stage of the
change. That offer SHALL write the change's configuration, leave every key
it does not set unchanged, and remove any setting the new agent does not
accept.

Where the recommendation names more than one agent, each agent SHALL be
offered on its own.

What was written, and to which file, SHALL be said beside the control.

#### Scenario: Using the recommended agent

- **WHEN** the offer to use the recommended agent for every stage is taken
- **THEN** every stage of the change names that agent, and the change's
  other settings are unchanged

#### Scenario: A tie

- **WHEN** a recommendation names two agents
- **THEN** each agent is offered separately
