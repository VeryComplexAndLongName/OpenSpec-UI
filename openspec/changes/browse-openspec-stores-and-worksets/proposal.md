## Why

An OpenSpec plan can live in a registered store shared across code repositories. Workbench users need to see where specs live and which folders go together before opening a local plan.

## What Changes

Add OpenSpec Stores and Worksets to Workspace in VS Code and standalone. Read registered stores, show each local spec catalog on demand, and list member folders of saved worksets using the upstream read-only CLI JSON interface.

## Capabilities

### Modified Capabilities

- `openspec-workbench` gains the behavior described above.

## Changelog

### VS Code extension and standalone app

- Open **OpenSpec Stores and Worksets** to find registered planning stores, browse their specification titles and see the folders included in your saved worksets. This requires an OpenSpec CLI with beta stores and worksets.
