# Design

## Decisions

- Reuse `useEditorDarkTheme`, `metroRootClassName`, `metroCss`,
  `metroIconsCss`, `shellThemeCss` and `vscodeThemeCss`, exactly as the
  Harness Settings and Pipeline webviews do.
- Put theme ownership in a small shared Compliance webview root component so
  the real entrypoint and the theme test exercise the same wrapper.
- Keep `ComplianceView` transport-agnostic and leave the standalone shell's
  theme selection untouched.

### Rejected Alternatives

- Duplicating CSS variables or adding fixed light/dark colors is rejected:
  ADR-0030 maps colors to the active editor theme, including custom themes.
- Fixing only the panel HTML is rejected: it cannot add the Metro scope class
  or react to theme-class changes without duplicating the existing hook.

## Non-Goals

- No change to Compliance checks, policy, persistence, REST, or message bridge.
- No change to the standalone theme, Metro component selection, or npm publish.

## Risks / Trade-offs

- A wrapper regression could affect CSS scope. The focused test asserts both
  the Metro root class and light/dark/high-contrast transitions, and the live
  VS Code smoke continues to verify the panel opens.