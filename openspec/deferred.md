# Deferred

Judgements about shipped work, raised by a change and outliving it.
Each line names the change it came from. Tick one when it has been
judged (a-change-lands-with-nothing-open).

- [ ] The first real rebase on this machine: a behind change branch is rebased and pushed by the sweep, its pull request's checks start again, and the editor's output says so (from a-behind-branch-is-rebased-for-you)
- [ ] The owner's editor, with a run ticking tasks and the Change Graph open with rows expanded, no longer holds a processor (from the-change-graph-reads-once)
- [x] The harness JSON schemas (packages/extension/schemas/agent-harness.schema.json, change-harness.schema.json) list 4 of the 13 top-level keys and set additionalProperties to false, so an editor validating a harness file against them flags budget, timeout, branches, archive and the rest as errors: bring them in line with TOP_LEVEL_CONFIG_KEYS, and test that they stay so (from a-landed-change-is-archived-for-you) - done in the-harness-schemas-know-every-key: the schemas are built from core and a test holds them to the validator
- [ ] A real run in the owner's workspace leaves a log in .openspec-ui/runs/, and the card's Logs, in the standalone and in the editor's Pipeline panel, shows what it said (from a-change-shows-its-run-logs)
- [ ] The owner's editor, on a release with main-follows-what-landed, fast-forwards main after an archive pull request merges, and the archived changes leave Changes and the Pipeline without a pull (from main-follows-what-landed)
