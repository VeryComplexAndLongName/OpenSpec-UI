## ADDED Requirements

### Requirement: An action on a change runs where the change is worked

`packages/core` SHALL say where an action on a change runs: in the working
directory the change is worked in, where that is another one, and in this
checkout otherwise. It SHALL refuse a writing action only where the
records reporting from that directory do not check out, naming the
directory. A host SHALL find that directory from the repository's own
worktree list, and SHALL NOT act on a path a request names.

#### Scenario: A change worked in its own worktree

- **WHEN** a host asks where to act on a change worked in its own worktree
- **THEN** core answers that worktree, and refuses nothing
