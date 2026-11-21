# Verification

Date: 2026-11-21

- Parsed the repository configuration through the current Workbench reader.
- Verified the global configuration and resolved active changes.
- Verified both Claude adapters still expose their model and custom-agent settings.
- Removed Claude model IDs only from the assignments migrated to Codex ACP.
- Preserved supported effort and repository-level autonomy, review and run limits.

Focused local checks
- Core registry and default runners: 34 passed.
- Extension repository setup: 13 passed.
- AI panel command selection: 72 passed.
- Server permission/question routing: 2 passed.
- Chain default-agent audit: 1 passed.
- Scoped ESLint passed.
- Core/extension, Server and Shared UI TypeScript checks passed.
- Authored Changeset validation passed.

The repository's pinned OpenSpec 1.7.0 strict validation passed for all 23 items.
Full CI is pending on the pull request.

## Pull-request outcome

https://github.com/VeryComplexAndLongName/OpenSpec-UI/pull/999

Merged commit c8ba6d5965e0ede8b9405f6e0dde47d83ab72422.
All applicable pull-request checks passed for the merged head.
