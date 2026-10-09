## Context

ADR 0045 sets the rule and the renaming tables. This change carries it out
for the extension and the CLI. The card's toolbar and the tree's
**Actions...** (ADR 0044) and the message register (ADR 0046) come in their
own changes, and use the vocabulary this one adds.

## Decisions

1. **One vocabulary, in core, with no imports.** `action-vocabulary.ts`
   holds the verbs (group, danger by group), the nouns, and
   `readActionTitle`, `actionCommandId`, `actionCliForm`. `webui` will read
   it as the extension does, so it is exported from the browser surface too.
2. **The manifest is generated, not hand-edited, this once.** A script maps
   each former id to its pair and rewrites the command's id, title,
   category and icon, then every reference to the id in code, tests and
   live documents. The specs change through this change's deltas, never
   directly.
3. **The CLI routes, its handlers stay.** `subcommands.ts` maps each pair to
   the handler's internal name and positionals (`complete task <change> <n>`
   reaches `task done <change> <n>`), so the handlers and their tests keep
   their shape. `publicNameOf` names a handler by its pair in every message
   a person reads.
4. **A former name is refused, not served.** `routeSubcommand` tells a
   former name from an unknown one, and the refusal names the pair, exit 2,
   `OSW-CLI-001` - the first identifier of ADR 0046's `CLI` group, before
   the register exists; that change takes it over.
5. **Validate is strict, and one command.** Both commands already ran
   `openspec validate --strict`; the second differed only in asking which
   change. "Validate Change" now asks when no change is selected.
6. **History keeps its words.** Archived changes, published articles and
   earlier ADRs are records of their time and are not rewritten.

## Risks / Trade-offs

- **A key binding or a script that used a former name breaks.** Accepted by
  the owner (ADR 0045); the CLI says what to use instead, the changeset
  lists the renaming, and the extension's README names the new commands.
- **A command's title alone is terser than before** ("Show Graph" for
  "Reveal in Change Graph"). Its tooltip and its place in a menu say the
  rest.
