This change reverses the plan's own wording. It was to be "a budget
suggested from what comparable changes cost"; measuring the history that
would read showed 13 of 22 changes have exactly one run and 16 have no
cost figure at all. So it recommends a template, never a number, and the
reversal is recorded rather than quietly performed.

## 1. What it reads

- [ ] 1.1 The change's open task count, from the task list. The strongest
  signal available with no history, and the one `determineStartStage`
  already trusts to decide where a chain begins.
- [ ] 1.2 Whether the change has run before and how those runs ended,
  through `buildChangeCostReport` — the same function the report uses,
  not a second implementation that can drift from it.
- [ ] 1.3 Nothing else. Not the diff, which does not exist before
  `apply`; not the delta count, which says little about cost.
- [ ] 1.4 Never derive a figure from one change's own history. That is
  the measurement above, and it is the whole reason this recommends a
  template.

## 2. What it says

- [ ] 2.1 One template, with the observations behind it returned
  alongside — not available on request, returned together.
- [ ] 2.2 A change with no history says so in the same breath as its
  answer, so "nothing is known" cannot be mistaken for "this is what the
  evidence suggests".
- [ ] 2.3 A change whose last run ended at a ceiling is moved one
  template up, and the reason names the ceiling.
- [ ] 2.4 A change cut repeatedly at the most generous template says a
  person should look, rather than proposing something larger again.

## 3. Where it appears

- [ ] 3.1 In the settings view, beside the templates and the diagnostic —
  the place someone goes deliberately to configure.
- [ ] 3.2 Applying it fills the form, exactly as applying a template
  does. Nothing is configured on a person's behalf.

## 4. Tests

- [ ] 4.1 A change with many open tasks and no history recommends the
  roomier template, and the grounds say there is no previous run.
- [ ] 4.2 A change with few open tasks and no history recommends the
  thriftier one.
- [ ] 4.3 A run cut by a time ceiling moves the recommendation up, and
  the grounds name that ceiling.
- [ ] 4.4 Two cuts at the most generous template asks for a person.
- [ ] 4.5 The grounds are always present, including when they say
  nothing is known — asserted directly, since an empty grounds list is
  what silently presenting a default would look like.

## 5. Verification

- [ ] 5.1 `openspec change validate --strict recommend-a-template`.
- [ ] 5.2 `npm run typecheck`, `npm run lint`, `npm run test` on an idle
  machine. Read the whole failing-file list, not the first familiar line.
- [ ] 5.3 Version bump via `npx changeset` for `core` and `webui`.
- [ ] 5.4 Run it over every change in this repository's own audit log and
  record the spread of recommendations. A recommender that answers the
  same thing for all 22 is not reading anything; one that answers
  differently for changes that plainly differ is doing its job. Record
  which.
- [ ] 5.5 **Human-only**: read the recommendation for a change you know
  well and judge whether its stated grounds match your own reasoning. The
  grounds are the product here — a right answer for a wrong reason is
  still wrong.
