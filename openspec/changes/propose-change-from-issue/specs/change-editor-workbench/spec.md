## ADDED Requirements

### Requirement: A confirmed repository issue can seed Propose

Both hosts SHALL preview a GitHub, GitLab or Gitea issue belonging to the workspace origin and SHALL create a change with a bounded source snapshot only after explicit confirmation. The existing worktree/share behavior SHALL be disclosed. The source SHALL enter Propose as reference data, without declaring planning complete or launching an agent.

#### Scenario: Preview then create

- **WHEN** the user supplies a repository issue number or matching issue URL
- **THEN** the host shows its canonical link, title, body, state and any truncation
- **AND** preview alone creates no files or branches
- **WHEN** the user confirms and the re-read revision still matches
- **THEN** the existing create workflow retains the source before initial sharing
- **AND** a subsequent explicit Propose receives the source as untrusted data

#### Scenario: Source changed or cannot be read

- **WHEN** confirmation re-reads a changed issue, a PR response or an unavailable source
- **THEN** creation is refused before any worktree or change is created
- **AND** the user can preview again

#### Scenario: Unsafe reference or source file

- **WHEN** a reference points outside the configured repository, or a source file is oversized, linked outside the change, malformed or not a regular file
- **THEN** no supplied URL is fetched and no unsafe file enters the agent context
- **AND** existing command, cwd and audit protections remain in force
