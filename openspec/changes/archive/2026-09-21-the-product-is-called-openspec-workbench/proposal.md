## Why

The product is OpenSpec Workbench. The root README, the extension's
Marketplace name and ADR 0003 all say so. But on 2026-09-21 the owner
noticed that the standalone's headline still reads "OpenSpec UI", and
asked for the extension to be checked too. It says the old name in 274
places a person reads:

- every Command Palette title (`OpenSpec UI: Status` and the rest);
- notifications, errors and progress titles;
- webview titles;
- the standalone's app bar and page title;
- the server's startup line;
- the JSON schemas' titles;
- the how-to guides and `HARNESS.md`, which quote those titles.

## What Changes

- "OpenSpec UI" becomes "OpenSpec Workbench" everywhere a person reads it:
  command titles, messages, panel and page titles, the headline, the
  server's startup line, the schema titles, and the documentation that
  quotes them.
- The pictures that show the headline or a panel title are taken again.

Nothing a machine reads changes. The repository, the npm packages, the
CLI's name, the extension's id, the `openspec-ui.*` settings and command
ids, and the `.openspec-ui/` directory keep their names. A user's
settings, keybindings and state carry over untouched.

## Capabilities

### New Capabilities

(none)

### Modified Capabilities

- `standalone-app` - the headline's name.
- `vscode-extension` - the headline's name.

## Impact

- 46 files; the replacement is textual, and every test that quoted the
  old name quotes the new one.
- `docs/images/standalone/*` and `docs/images/extension/*` taken again.
- A changeset: every package a person reads changes.

## Explicitly out of scope

- **History.** `CHANGELOG.md` files, the ADRs, the archive and the
  articles say what was true when they were written.
- **`packages/cli/README.md`'s "OpenSpec UI monorepo".** That names the
  repository, which keeps its name.
