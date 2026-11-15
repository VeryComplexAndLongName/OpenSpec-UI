## Approach

Read the versioned upstream JSON from the existing OpenSpec CLI wrapper. Treat store ids returned by the CLI as selectors, never accept an arbitrary path from the UI, and leave local stores, worksets and process settings untouched.
