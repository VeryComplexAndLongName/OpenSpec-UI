## Context

`the-supervisor-changes-agents` accepts `supervisor.mode: "act"` only in a
change's own file that also sets `autonomyLevel: "autonomous"`
(ADR 0018: what widens authority is per-change only). The rule is checked
when a file is written and when it resolves. Applying a named
configuration lays the configuration over the change's file and keeps
every other key (applying-a-template-keeps-the-rest); every named
configuration sets `semi-autonomous`; so the result kept Act and lost
Autonomous, and was refused.

## Decisions

1. **An edit that lowers the level turns Act off.** One function in core,
   `withoutActItCannotUse(config)`, removes `supervisor.mode` where it is
   `act` and the same config's `autonomyLevel` is not `autonomous`, and
   says whether it did. A `supervisor` left empty is removed. The fallback
   agents and the allowances stay: they do nothing without Act, and they
   are what a person set.
   - *Alternative: refuse with a clearer message.* Rejected by the owner:
     applying a configuration is a decision to change the level, and the
     configuration should apply.
   - *Alternative: keep Autonomous instead.* Rejected: it would widen what
     the configuration says, which is the direction ADR 0018 forbids
     guessing in.
2. **Where it applies.** `changeTemplateConfigToWrite`, the one function
   every surface applies a configuration to a change through (extension,
   standalone settings view, standalone run dialog), and
   `changeConfigToSave`, which a change's Harness Settings save through.
3. **It is said.** The extension's applied note and the settings view's
   applied message add that the supervisor's Act is off, because it acts
   only under Autonomous and the configuration sets another level. The
   settings view's note under the supervisor, which said saving would be
   refused, says Act turns off when the form is saved.
4. **A hand-written contradiction is still refused.** The validator does
   not change: a file that says Act and a lower level in one breath states
   two things, and the product does not pick one.

## Risks / Trade-offs

- **A person may not notice Act went off.** It is said on the surface that
  applied or saved it, and the change's Harness Settings show the mode.
