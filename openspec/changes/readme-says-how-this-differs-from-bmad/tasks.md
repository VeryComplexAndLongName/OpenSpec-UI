This section is read by people deciding whether this repository is worth
their time next to a method they already know. Every claim about this
repository must link to the document that establishes it, and every claim
about BMAD must be something BMAD's own pages say.

## 1. The section

- [x] 1.1 `README.md` gains `## How this differs from BMAD`, directly after
  `## Why not just openspec view`.
- [x] 1.2 It says what BMAD is, quoting its own description, linking
  `https://github.com/bmad-code-org/BMAD-METHOD`, and stating the date the
  description was read.
  Read 2026-09-13 from the repository's `README.md` and
  `https://docs.bmad-method.org/`: "turn an idea or change request into
  working software without giving up the thinking"; "BMad adds a set of
  named commands, called skills, to AI coding tools such as Claude Code
  and Cursor"; the loop "Clarify → Plan → Build and verify → Learn and
  adjust"; "product, architecture, UX, development, and testing
  expertise"; installed as a Skills CLI, a Claude Code plugin or a Codex
  plugin.
- [x] 1.3 It says what the two share: work written down before it is built,
  steps taken in turn by different expertise, and a check between building
  and accepting.
- [x] 1.4 It says where this repository differs, each as a fact about this
  repository with a link:
  - it runs the agents itself (`HARNESS.md`);
  - a change's specification outlives the change (`openspec/README.md`);
  - where a person decides is configuration the runner enforces
    (`HARNESS.md`);
  - spending is capped and every run is audited (`LIMITS.md`,
    `HARNESS.md`);
  - several changes run at once, and the Pipeline shows it (`docs/adr/`).
- [x] 1.5 It says that BMAD's pages were not found to describe spending
  limits, an audit log or parallel runs, and that this is not a claim BMAD
  lacks them.
- [x] 1.6 It says the two are not exclusive.

## 2. Verification

- [x] 2.1 This change validates strictly. `check(validate-change)`
- [x] 2.2 `npm run lint:english` passes.
- [x] 2.3 Every link the section adds resolves to a file in this repository
  or to BMAD's repository.
- [x] 2.4 No changeset: documentation only, as
  `openspec/changes/archive/2026-09-03-agentic-harness-documentation/` has
  none.
