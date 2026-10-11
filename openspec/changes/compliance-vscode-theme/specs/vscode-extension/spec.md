## ADDED Requirements

### Requirement: VS Code webviews follow the editor theme

Every VS Code webview SHALL mount the shared Metro root class and map its
palette from VS Code theme variables. The webview SHALL follow editor light,
dark and high-contrast theme changes while it remains open. It SHALL NOT use
fixed product colors in place of the editor palette.

#### Scenario: Compliance opens in a light editor theme

- **WHEN** the Compliance webview opens with `vscode-light` on the body
- **THEN** its root includes `openspec-metro` and excludes `dark-side`
- **AND** its controls use the mapped VS Code theme variables

#### Scenario: Compliance opens or changes to a dark editor theme

- **WHEN** the Compliance webview opens with `vscode-dark` or the body changes
  from light to dark while it is open
- **THEN** its root includes `dark-side` without reloading the panel

#### Scenario: Compliance changes to a light or high-contrast-light theme

- **WHEN** the editor body changes to `vscode-light` or
  `vscode-high-contrast-light`
- **THEN** `dark-side` is removed while `openspec-metro` remains

#### Scenario: Compliance changes to high-contrast dark

- **WHEN** the editor body changes to `vscode-high-contrast`
- **THEN** `dark-side` is present and contrast colors remain sourced from
  VS Code variables