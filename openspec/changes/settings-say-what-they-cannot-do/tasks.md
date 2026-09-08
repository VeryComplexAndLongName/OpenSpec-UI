The blocking fact is that nothing in the code knows which agents report
usage — `HARNESS_AGENT_CAPABILITIES` records what can be sent to an
agent, never what comes back. Until that exists, no surface can warn
about any of this.

## 1. Recording what an agent reports

- [ ] 1.1 A field beside `effort` and `budgetField` in
  `HARNESS_AGENT_CAPABILITIES`, so the validator, the settings surface
  and the documentation read one table rather than three that drift.
- [ ] 1.2 Four states, not two: reports cost and tokens, tokens only,
  nothing, and never observed. The fourth is what keeps this honest —
  recording an unobserved agent as silent would produce a confident
  warning about a fact nobody checked.
- [ ] 1.3 Fill it from `LIMITS.md`'s measurements, and cite them where
  the field is defined: `claude-cli-acp` cost and tokens, measured;
  `copilot-cli-acp` tokens only, measured at 786,966 in and no cost
  field; the six raw-text agents nothing, certain because plain text
  carries no figure; `gemini-cli-acp` and `codex-cli-acp` unobserved.
- [ ] 1.4 Point `LIMITS.md`'s table at the field, so the next person to
  measure an agent updates one place and both stay true.

## 2. Reading a configuration

- [ ] 2.1 A core function over a resolved `HarnessConfig` returning what
  it cannot do. No host imports, no files — the shape `usage-report.ts`
  and `change-cost-report.ts` already use.
- [ ] 2.2 A cost ceiling over a stage whose agent reports no cost cannot
  act; say so, naming the stage and the agent.
- [ ] 2.3 A token ceiling over `claude-cli-acp` counts a fraction of what
  moves — `maxTokens` sums input and output only, and a measured run of
  that agent moved 1,693,507 cache tokens against 8,322 counted. Report
  it as a ceiling that will rarely act rather than one that cannot.
- [ ] 2.4 A stage whose agent reports nothing **and** has no time ceiling
  can run without any bound. This is the finding that matters most, and
  it is the one that did not exist before `run-has-a-time-limit`.
- [ ] 2.5 An agent whose reporting was never observed produces "not
  known", never an assertion either way.
- [ ] 2.6 State what cannot happen. Do not recommend a value: that needs
  history, and it belongs to the change after the templates.

## 3. Where it is shown

- [ ] 3.1 On the harness settings surface, with the configuration it
  describes. A warning someone has to ask for is read by someone who
  already suspects the problem.
- [ ] 3.2 Also as a command, because `HARNESS.md` says outright that some
  settings have no control in either host and must be hand-edited — a
  person doing that has no settings screen open.
- [ ] 3.3 Never refuse the configuration. An operator may knowingly leave
  one stage unbounded, and that judgement is theirs.

## 4. Tests

- [ ] 4.1 A cost ceiling with `copilot-cli-acp` on a stage is reported as
  unable to act.
- [ ] 4.2 A token ceiling with `claude-cli-acp` is reported as rarely
  acting, with the measured reason.
- [ ] 4.3 A stage on a silent agent with no timeout is reported as
  unbounded; adding a timeout removes that finding.
- [ ] 4.4 An unobserved agent produces "not known" and neither of the
  assertions.
- [ ] 4.5 A configuration whose ceilings all act produces no findings —
  the case that must stay quiet, or the surface becomes noise people
  learn to ignore.
- [ ] 4.6 The configuration is still valid and still saved with findings
  present.

## 5. Verification

- [ ] 5.1 `openspec change validate --strict settings-say-what-they-cannot-do`.
- [ ] 5.2 `npm run typecheck`, `npm run lint`, `npm run test` on an idle
  machine. Read the whole failing-file list, not the first familiar line.
- [ ] 5.3 Version bump via `npx changeset` for `core`, `webui` and the
  extension.
- [ ] 5.4 Run it over this repository's own `openspec/agent-harness.json`
  and record what it says. That file is a real configuration written by
  someone who knew the rules, so a finding on it is worth reading twice —
  either it is a genuine gap or the check is too eager.
- [ ] 5.5 **Human-only**: open the harness settings, choose an agent that
  reports no cost with a cost ceiling set, and confirm the finding
  appears without the configuration being refused.
