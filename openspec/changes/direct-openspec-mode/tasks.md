## 1. Extension command surface

- [x] 1.1 Remove contributed `plan`/`implement`/`review`/`cancel` commands.
- [x] 1.2 Keep and simplify `status` command to direct OpenSpec JSON execution.
- [x] 1.3 Remove agent-specific extension settings.

## 2. Runtime behavior

- [x] 2.1 Update run controller to support status without agent runners.
- [x] 2.2 Stop creating default AI runners in server runtime.
- [x] 2.3 Keep optional local-server mode for OpenSpec UI shell.

## 3. Shared UI

- [x] 3.1 Remove agent picker from run panel.
- [x] 3.2 Expose direct command set `status`/`list`/`show`/`validate` in run panel.
- [x] 3.3 Keep structured status JSON rendering card while rendering other JSON outputs safely.

## 4. Verification

- [x] 4.1 `npm run test --workspace @openspec-ui/core`
- [x] 4.2 `npm run test --workspace @openspec-ui/webui`
- [x] 4.3 `npm run test --workspace @openspec-ui/server`
- [x] 4.4 `npm run test --workspace openspec-ui-vscode`
- [x] 4.5 `npm run typecheck --workspaces --if-present`
