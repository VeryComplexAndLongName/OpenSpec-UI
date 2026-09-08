## ADDED Requirements

### Requirement: The published manifest stays retrievable at the commit it was announced at

Publishing the manifest SHALL add to the publishing branch's history
rather than replace it. The branch SHALL NOT be deleted or rewritten as
part of publishing.

A consumer resolves the manifest to a commit and then fetches it by that
commit. Replacing the branch with an unrelated history makes the commit
it resolved stop existing, which the consumer cannot distinguish from the
document having been withdrawn.

Where the repository announces that a manifest was published, the
announcement SHALL identify the commit the manifest is in, not the commit
that caused the release. They are commits in different histories, and
only the first can be fetched.

#### Scenario: A second release is published

- **WHEN** the manifest is published and a manifest was published before
- **THEN** the earlier commit is still reachable, and the new one has it
  as an ancestor

#### Scenario: A consumer fetches at the announced commit

- **WHEN** a consumer fetches the manifest at the commit the
  announcement named
- **THEN** the document is retrievable there

#### Scenario: The publishing branch does not exist yet

- **WHEN** the manifest is published and no publishing branch exists
- **THEN** it is created, and subsequent publishes add to it

#### Scenario: Two publishes race

- **WHEN** two runs try to publish different manifests at once
- **THEN** one of them fails rather than silently replacing the other's
  commit
