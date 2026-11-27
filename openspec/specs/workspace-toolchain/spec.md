# workspace-toolchain Specification

## Purpose
Help team members reproduce the OpenSpec toolchain and instructions by reporting
where a workspace differs from its checked-in declaration.

## Requirements

### Requirement: Workspace diagnosis compares declared tooling and instructions

The existing terminal and VS Code diagnosis SHALL optionally read the
workspace's Workbench toolchain declaration. It SHALL report an unavailable
or different OpenSpec version and any missing, unreadable or different
instruction file. The diagnosis SHALL read bounded files inside the workspace
and SHALL normalize CRLF when hashing instruction text. Workspace diagnosis
remains advisory.

#### Scenario: A teammate uses a different OpenSpec version and instructions

- **WHEN** diagnosis sees a declared version and instruction fingerprint that differ from its observations
- **THEN** it identifies the mismatches and the expected values

#### Scenario: A declared file is unavailable or outside the workspace

- **WHEN** a declared instruction file is missing, unsafe, or unreadable
- **THEN** diagnosis reports that problem without reading outside the workspace
