# Review files outside a change's declared scope

Commit `change-scope.json` beside the proposal before implementation:

```json
{
  "paths": [
    "src/auth/",
    "tests/auth.test.ts",
    ".changeset/"
  ]
}
```

Open **Show PR Review** from the change's working directory. **Declared change scope** lists committed paths outside the declaration for the same head and comparison base as the displayed diff. **Copy PR summary** preserves the result and its qualifications in both the standalone app and VS Code.

An exact path allows one file. A trailing slash allows descendants of that directory, so `src/auth/` does not allow `src/authentication.ts`. Matching follows case-sensitive Git paths, including on Windows. Both paths of a rename are checked. Files inside this change's own `openspec/changes/<id>/` directory are included implicitly; other changes and the main specifications need explicit paths. An empty `paths` array allows only the change's own planning directory.

Use repository-relative forward-slash paths. Absolute paths, drive prefixes, backslashes, control characters, empty or dot/dot-dot segments, glob syntax and duplicate entries are refused. The file is limited to 64 KiB, 256 entries and 500 characters per entry. A missing or invalid file means scope is unknown, not that there were no unexpected edits. Up to 30 outside paths are displayed with the complete count.

When the declaration is new or changed since the comparison base, review that diff too. Expanding the declaration does not establish approval. This advisory check observes committed paths; it neither enforces agent permissions nor proves that the implementation meets its requirements. Dirty working-tree changes are excluded. **Changes since last review** uses the locally marked review commit as its comparison base and keeps the same limits.
