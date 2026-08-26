# @openspec-ui/core

## 0.25.0

### Minor Changes

- Add a new built-in template, `adopt-changesets` (category
  `release-management`), for proposing Changesets adoption in an npm
  workspaces monorepo from an OpenSpec change. It bakes in the
  `privatePackages` configuration gotcha discovered adopting Changesets in
  this repository, and a verification step that confirms a real changeset
  actually changes a version and changelog rather than trusting a clean
  exit code.
