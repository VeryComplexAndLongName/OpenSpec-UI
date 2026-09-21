## Why

VS Code checks `openspec/agent-harness.json` and every change's
`harness.json` against the JSON Schemas the extension ships. Those schemas
were written by hand once and never kept up. Found on 2026-09-21 while
adding `archive.whenLanded`:

- they list 4 of the 14 top-level keys and set `additionalProperties:
  false`, so `budget`, `timeout`, `maxStageAttempts`, `hints`,
  `allowAgentMessages`, `branches`, `archive` and, in a change's file,
  `gitStageAllowlist`, `taskAgents` and `steps` show as errors;
- a stage's agent may only be a bare id, so the object form with a model,
  an effort, a budget or a custom agent shows as an error;
- the agent list lacks the four ACP agents and `vscode-chat`;
- `stepAgents.archive` and `stepAgents.git` are allowed, though the
  product refuses them.

Checked against this repository's own files: the shipped schemas flag 10
of its 16 harness files, every one of which the product reads without
complaint. The owner asked for this to be fixed before anything else.

## What Changes

- **The schemas are built from core.** `harnessConfigJsonSchema(scope)`
  in `packages/core` builds either one from the same lists the validator
  enforces:
  - the top-level keys;
  - the stages that take an agent;
  - the agent registry with each agent's model and custom-agent flags;
  - each agent's accepted efforts and budget unit;
  - the autonomy levels;
  - the task-number pattern;
  - the declared chain steps;
  - the rules a global file is held to.

  It throws when a top-level key has no entry.
- **`npm run schemas --workspace packages/extension`** writes the two
  files, and a test fails when they differ from what core builds.
- **The schema answers as the validator does.** The test runs the
  validator and the schema over every agent with every field an entry
  may carry, and over every rule a global file is held to. The two must
  agree. The four places where they knowingly differ are written down
  and asserted as differences:
  - two relations between numbers are beyond a JSON Schema;
  - two keys the product ignores are marked by the editor.
- `ajv` and `tsx` become the extension's development dependencies. Both
  were already installed through other packages.

## Capabilities

### New Capabilities

(none)

### Modified Capabilities

- `vscode-extension` - the schemas it validates harness files against.

## Impact

- New `packages/core/src/harness-config-schema.ts`, exported from core.
- `packages/extension/schemas/agent-harness.schema.json` and
  `change-harness.schema.json`, now generated.
- New `packages/extension/scripts/write-harness-schemas.mts` and
  `packages/extension/src/harness-schemas.test.ts`.
- `packages/extension/package.json` and `package-lock.json` (two dev
  dependencies and a script).
- `openspec/deferred.md`: the item raised by
  `a-landed-change-is-archived-for-you` is ticked.
- A changeset: core and the extension change.

## Explicitly out of scope

- **`template.schema.json`.** It describes a different file, and nothing
  found it wrong.
- **Messages in the editor.** A JSON Schema's own messages are what VS
  Code shows. Each property carries a description, and that is what
  hovering shows.
