## ADDED Requirements

### Requirement: A permission's answer reaches the agent that asked, in either host

A `resolvePermission` command that names no agent SHALL be delivered, in the
standalone server as in the VS Code extension, to the runner that holds the
run it names, and never to the default runner in its place.

#### Scenario: Answering a non-default agent from the standalone AI panel

- **WHEN** a single-stage run on an ACP agent that is not the default one
  emits a `permissionRequest`, and the AI panel sends **Allow** naming no
  agent
- **THEN** that agent's runner receives the answer and the run goes on,
  and the default runner receives nothing