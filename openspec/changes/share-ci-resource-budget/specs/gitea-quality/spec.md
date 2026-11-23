## ADDED Requirements

### Requirement: Shared executor budget
OpenSpec quality jobs SHALL join the host's bounded user.slice while retaining their existing per-job CPU and memory limits and host Docker socket prohibition.

#### Scenario: Runner policy omits the shared parent
- **WHEN** the runner config removes --cgroup-parent=user.slice
- **THEN** the runner policy check rejects the configuration

#### Scenario: Quality job starts on the shared host
- **WHEN** a quality job starts after the updated runner config is deployed
- **THEN** its processes belong to user.slice under the host CPU and memory ceilings
