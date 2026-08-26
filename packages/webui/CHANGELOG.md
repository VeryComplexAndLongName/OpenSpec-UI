# @openspec-ui/webui

## 1.10.0

### Minor Changes

- Notify when a `plan`/`implement`/`review` run finishes while you're not
  watching the Processes view or the AI panel. The VS Code extension shows a
  native notification (with a "View" action that opens the Process
  Dashboard); the standalone app shows a browser notification, once
  permission is granted. `status`/`list`/`show`/`validate` (near-instant) and
  `cancelled`/`interrupted`/`rolled-back` runs are not notified.
