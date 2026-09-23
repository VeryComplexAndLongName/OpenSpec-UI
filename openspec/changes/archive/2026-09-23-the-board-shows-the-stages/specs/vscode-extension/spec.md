## ADDED Requirements

### Requirement: The editor's Pipeline reads the stages

The Pipeline panel SHALL answer the `pipeline/stages` operation with one
summary per active change, read against the host's own workspace root and
never a root a message names, and SHALL leave the visits out.

#### Scenario: A message naming another root

- **WHEN** the webview asks for the stages with a `cwd` of its own
- **THEN** the panel reads its own workspace root and answers from that
