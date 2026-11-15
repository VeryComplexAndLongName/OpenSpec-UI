---
title: "Find the shared spec across repositories"
published: false
description: "Browse local OpenSpec Stores and Worksets to see where shared requirements live and which folders belong to the same work."
tags: openspec, git, devtools, vscode
cover_image: https://raw.githubusercontent.com/VeryComplexAndLongName/OpenSpec-UI/main/docs/articles/site/where-the-shared-spec-lives/cover.png
canonical_url: https://openspec-ui.dev/articles/where-the-shared-spec-lives/
---

*First published on [openspec-ui.dev](https://openspec-ui.dev/articles/where-the-shared-spec-lives/).*

Suppose a checkout change involves a web app, an API and a repository that holds the team's shared specifications. The postal-code contract belongs to the planning repository. The code that uses it lives in the web and API repositories. The first question when opening a checkout is where the shared requirement lives on this machine.

OpenSpec Stores and Worksets are beta features in the upstream CLI. A store is a registered local checkout that holds specs and changes. A workset is a saved list of folders you work in together. The same workset can include the planning store and two code repositories. [OpenSpec Stores and Worksets guide](https://github.com/Fission-AI/OpenSpec/blob/main/docs/stores-beta/user-guide.md)

## Start from the workspace

Choose **Show OpenSpec Locations** in the VS Code Workspace view or in the standalone workspace panel. The view lists registered stores and their local roots, then the saved worksets and the path of each member. Select a store to see its specification identifiers and requirement counts.

For the checkout example, open the workspace's location list and find the workset containing the web app, the API and the planning checkout. Select the planning store and look for its checkout specification. The folder paths give you the context to open the right checkouts before you review a proposal or ask an agent to work on the change.

Workbench reads the same local registrations as the upstream CLI. Use a CLI version that supports Stores and Worksets. If the list is empty on a new machine, use `openspec store list --json` and `openspec workset list --json` to verify what is registered there. [OpenSpec Workbench release notes](https://github.com/VeryComplexAndLongName/OpenSpec-UI/releases/tag/openspec-ui-vscode%400.110.0)
