## 1. Server API

- [x] 1.1 Add endpoint to create a change from UI input.
- [x] 1.2 Add endpoint to read editable markdown files for a change.
- [x] 1.3 Add endpoint to save edited markdown files for a change.

## 2. Standalone UI

- [x] 2.1 Add Change Editor section with change selection and create action.
- [x] 2.2 Add markdown editors for proposal/design/tasks/spec.
- [x] 2.3 Add markdown preview for edited content.
- [x] 2.4 Wire save flow and refresh change list/status after save.

## 3. Verification

- [x] 3.1 `npm run test --workspace @openspec-ui/server`
- [x] 3.2 `npm run test --workspace @openspec-ui/webui`
- [x] 3.3 `npm run typecheck --workspaces --if-present`

## 4. OpenSpec Initialization UX

- [x] 4.1 Detect OpenSpec initialization artifacts from selected `cwd` in server overview.
- [x] 4.2 Add server endpoint to run `openspec init --tools` only when artifacts are missing.
- [x] 4.3 Add standalone UI controls for selecting AI tools and running initialization.
- [x] 4.4 Hide initialization action after artifacts are detected.
