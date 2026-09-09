## ADDED Requirements

### Requirement: The configuration is edited through the same view in every host

The harness configuration SHALL be editable through the same settings
view in every host, with the same pickers and the same diagnostics.

A host that offers only the file offers none of what the surface knows:
which effort values the chosen agent accepts, which spending field it
honours, which custom agents the workspace defines, and which of the
configured ceilings cannot act. A person editing the file is doing the
validator's work from memory.

The file SHALL remain the configuration and SHALL remain hand-editable,
and the view SHALL name it. A view that replaces a file people already
edit takes away a way of working; one that names it does not.

A refused write SHALL be reported where the edit was made. A form that
cannot say a save was refused is indistinguishable from one that saved.

#### Scenario: Editing the configuration in the editor host

- **WHEN** the harness configuration is opened for editing in VS Code
- **THEN** the settings view is shown, with the same pickers and
  diagnostics the standalone shell shows, and it names the file it edits

#### Scenario: A save the configuration refuses

- **WHEN** a saved configuration is rejected
- **THEN** the reason is shown where the edit was made

### Requirement: The webview can ask its host a question

Where a host renders the shared components without a server, the webview
SHALL be able to ask that host for something and receive an answer or an
error.

A one-way command with a stream of events cannot express a read, and a
surface that reads nothing can only be told what to show — which is why
the settings view could not exist in that host.

A request SHALL name an operation the host offers, never a path, a file
or a function. The host SHALL refuse an operation it does not offer, and
SHALL use its own workspace root rather than one named in the message.

#### Scenario: Asking for the resolved configuration

- **WHEN** the webview asks its host for something it offers
- **THEN** the answer comes back against that request

#### Scenario: Asking for something the host does not offer

- **WHEN** a request names an operation the host does not offer
- **THEN** it is refused, and nothing is read or written
