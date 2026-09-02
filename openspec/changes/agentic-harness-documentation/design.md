## Context

Facts read from the source on 2026-09-02, and the reason this change
exists as a design question rather than a writing task:

- `README.md` contains no occurrence of "harness".
- `docs/images/` holds seventeen screenshots, none produced by any
  script: `grep -rn "docs/images"` over the repository's own code, CI and
  tooling returns nothing. Every one is a manual capture.
- `docs/images/standalone/harness-settings.png` dates from 2026-08-31.
  `HarnessSettingsView.tsx` has six commits since 2026-08-25.
- `packages/server` already depends on `@playwright/test` and
  `@axe-core/playwright`, runs four e2e specs, and has a `test:browser`
  script and a CI job. The machinery to drive the standalone UI exists.
- No equivalent exists for the extension: its integration tests run
  inside a real VS Code (`src/test/run.mjs`), and that host has not been
  drivable in this environment at all — see `audit-log-persistence` task
  4.2, where the Electron host failed before running any test.

## Goals / Non-Goals

**Goals:**

- One page a user can read to configure the harness without reading an ADR.
- One page that says what a limit is, in what unit, evaluated when.
- Screenshots that cannot silently disagree with the interface.

**Non-Goals:**

- Replacing the ADRs. They record why; these record what.
- Documenting the harness's internals — stage dispatch, the journal, the
  scheduler. A user does not configure those.

## Decisions

### Two documents, not one

`HARNESS.md` answers "how do I set this up". `LIMITS.md` answers "what
stops it, and when". They are separated because the second is the one
somebody reads while worried about a bill, and making them find it inside
a longer page is a poor way to answer that question.

**Rejected alternative**: one `HARNESS.md` with a limits section.
Rejected — the limits material is the part most likely to be linked to
directly, from a run that stopped on a ceiling, and a deep link into a
long page is a worse landing place than a page.

### Standalone screenshots are generated; VS Code's are not

A new Playwright spec drives the standalone settings surface and writes
`docs/images/standalone/harness-*.png`. Regenerating is one documented
command, and the images become a product of the same code the tests
already exercise.

**Rejected alternative**: capture both by hand, as today. Rejected on the
evidence already in the repository — the current harness screenshot shows
a settings screen that stopped existing three commits ago, and nothing
announced it.

**Rejected alternative**: generate the VS Code ones too. Rejected as not
possible here rather than undesirable: the extension's own host could not
be started in this environment even for its integration tests. Claiming
automation for images that a person will keep producing by hand would put
a false statement in the document this change exists to make true. They
are labelled with the date and extension version they show, so a reader
can judge their age — which is the honest version of the same guarantee.

**Rejected alternative**: check the generated images into CI as a
failing-on-diff gate. Rejected for now: image diffs are noisy across font
rendering and platform, and a gate that cries wolf is the failure mode
this repository spent the week removing. The command is documented and
cheap; a gate can follow once the images have proven stable.

### Every agent id gets a row, including the ones nothing here can run

The reference table names all ten ids — five CLI adapters, four ACP
adapters, and the chat target — with what each accepts. `codex-cli` and
`gemini-cli` carry the same statement `README.md` already makes: no
binary for either has ever been run by this project, so their rows are
transcribed from upstream documentation.

**Rejected alternative**: document only what has been live-verified.
Rejected — a user who picks `gemini-cli` needs to know what it accepts
*and* that nobody here has watched it work. Omitting the row hides the
second half along with the first.

### ACP is described as what it is

The request asks to document that "agents can communicate over the ACP
protocol". The accurate statement is narrower and must be written
narrowly: ACP is the protocol between **the harness and one agent
process** — structured `session/update` progress instead of scraped text,
and a `session/request_permission` gate where the agent offers one. It is
not a channel between two agents, and no agent in this repository sends a
message to another. ADR 0018 describes event-driven orchestration between
*stages*, which is a different mechanism and is also not agent-to-agent
messaging.

Writing it the way it was asked would put a capability in the
documentation that does not exist in the product, which is precisely the
class of defect this repository has spent the week removing from its own
configuration surface. The document says what ACP gives (structured
output, a permission gate, version-checked adapters) and says plainly what
it does not.

## Risks / Trade-offs

- **[Risk]** A reference document is another thing that can go stale. →
  **Mitigation**: the settings tables are generated from
  `HARNESS_AGENT_CAPABILITIES` and `AGENT_REGISTRY` where practical, and
  a task asserts every agent id in the registry appears in the document,
  so a new adapter cannot be added without the table noticing.
- **[Trade-off]** Screenshot generation adds a Playwright spec whose only
  product is images. Accepted: it costs one spec and removes a category
  of silent rot that has already occurred once.

## Open Questions

- Whether `LIMITS.md` should also cover the CI job timeouts
  (`ci-job-timeouts`). They are ceilings, they are documented nowhere
  else, and they are not something a harness user configures. Leaning
  toward a single sentence pointing at the workflow file.
