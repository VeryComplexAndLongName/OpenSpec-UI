# 0045: Every Action Is a Verb and a Noun

Status: Accepted

Date: 2026-10-08

## Context

The owner, on 2026-10-08, of the Changes tree's context menu: a long list
of words, with one separator, and nothing to find one's way by. The 67
commands the extension contributes were named one at a time: "Run...",
"Say Something to This Run...", "Show What This Change Cost", "Open The
Working Directory This Change Is Worked In", "It Was Me...", "Review Diff
(tasks.md vs HEAD)". The CLI's subcommands were too: `ready`, `doctor`,
`advise`, `present`, `claim`, `send-back`. Nothing says how the next one
is to be named, so each new one adds a new pattern.

The owner proposed PowerShell's rule: every command is `<Verb>-<Noun>`,
from an approved list of verbs. And a clean break: the product has 58
installs and 40 updates as of 2026-10-07, so old names do not stay beside
the new ones.

## Decision

1. **An action is named `<Verb> <Noun>`**, with the verb from the list
   below and the noun from the list below. Each pair is one action, with
   one id in core (`configure.change-harness`), one title everywhere
   ("Configure Change Harness"), one icon and one group. Three dots end the
   title of an action that asks before it acts, as before.
2. **The verb decides the group and the colour**, so an action is
   recognised by its verb wherever it is shown, and a dangerous verb is
   always red and always confirmed. **The icon is the action's own**: no
   two actions share one (amended on 2026-10-09).

   | Group | Verbs |
   | --- | --- |
   | Run | Run, Continue, Update, Reopen, Stop, Send, Finish, Schedule |
   | Respond | Answer, Allow, Deny, Confirm |
   | Inspect | Show, Open, Find, Explain, Recommend, Validate, Diagnose |
   | Arrange | Filter, Clear, Hide, Refresh, Copy |
   | Set up | Configure, Set, Initialize, Write, Generate, Create, Edit, Insert, Add, Remove, Join, Restore, Commit, Complete, Move, Save |
   | Danger | Archive, Rollback, Delete |

   `Delete` destroys something (a change, a directory, a template);
   `Remove` takes away a link or a setting and loses no work.

3. **Nouns** name what is acted on: Change, Change Harness, Workspace
   Harness, Plan, Run, Item, Task, Tasks, Question, Questions, Permission,
   Message, Relation, Relations, Diff, Timeline, Comparison, Cost,
   Ancestry, Details, Status, Readiness, Advice, History, Stages, Graph,
   Worktree, Worktrees, Change Copy, Leftover, Template, Specs, Report, Rules,
   Instructions, Scoped Instructions, Dependabot, LLM Key, Key, Team,
   People, Owner, Implementer, Presence, Lock, Lease, Checks, Manifest,
   Workspace, Pipeline, Dashboard, Views, Archive, Archive Filter, Specs
   Filter, Graph Filter, Changes, Process, Implementation,
   Typecheck, Tests, Lint, CLI View, Actions, Main, Landed Changes, Logs,
   Path, Done Tasks, Chain, Agents, Command, Proposal, Design, Stage
   Agents, Settings, Templates, Summary, Configuration, Processes. A noun
   of two words is one noun.
4. **VS Code**: the command id is `openspec-ui.<verb><Noun>` in camel case
   (`openspec-ui.configureChangeHarness`); the title is the pair; the
   palette's "OpenSpec Workbench:" comes from the command's `category`, not
   from its title. Old ids are not kept.
5. **CLI**: a subcommand is the pair in lower case: `openspec-ui-cli
   answer question <change> <Q-id> "<answer>"`. An old subcommand is not an
   alias: it fails with a message naming the new one (ADR 0046's
   `OSW-CLI-…`), so a script finds out at once what to change and the
   vocabulary stays single.
6. **A test holds it**: every contributed command and every CLI
   subcommand is a pair from the lists; a pair has one icon wherever it
   appears, and no other pair has it; a Danger verb is confirmed.
7. **Validate is strict.** "Validate Change" runs `openspec validate
   --strict`, as the merge gate does; the separate non-strict command goes.

### The extension's commands

| Now | Becomes |
| --- | --- |
| Status | Show Status |
| Initialize Workspace... | Initialize Workspace... |
| Write Agent Workflow Rules (CLAUDE.md / AGENTS.md) | Write Rules |
| Generate Agent Instructions (CLAUDE.md / AGENTS.md)... | Generate Instructions... |
| Set Up Agentic Harness... | Initialize Workspace Harness... |
| Configure Dependabot... | Configure Dependabot... |
| Generate Path-Scoped Copilot Instructions... | Generate Scoped Instructions... |
| Configure Harness Settings | Configure Workspace Harness |
| Set Local LLM API Key... | Set LLM Key... |
| Configure Harness for this Change | Configure Change Harness |
| Run... | Run Change... |
| Create Change... | Create Change... |
| Create Change Template... | Create Template... |
| Validate Change | Validate Change |
| Validate Change (Strict) | (gone: Validate Change is strict) |
| Show Change Timeline | Show Timeline |
| Show What This Change Follows | Show Ancestry |
| Show What This Change Cost | Show Cost |
| Explain Harness Settings | Explain Change Harness |
| Recommend a Harness Configuration | Recommend Change Harness |
| Reveal in Change Graph | Show Graph |
| Reveal in Changes | Show Change |
| Open Pipeline | Open Pipeline |
| Archive Change | Archive Change |
| Read This Change As That Directory Has It... | Open Change Copy... |
| Open The Working Directory This Change Is Worked In | Open Worktree |
| Pick A Change, And See Where Each Is Worked... | Find Change... |
| Unarchive Change | Restore Change |
| Copy Tasks as Template Into... | Copy Tasks... |
| Customize Template | Edit Template |
| Insert Template Into... | Insert Template... |
| Delete Project Template | Delete Template |
| Delete Change | Delete Change |
| Delete Task | Delete Task |
| Run This Delegated Item | Run Item |
| It Was Me... | Confirm Key... |
| Answer This Question... | Answer Question... |
| Join the Team... | Join Team... |
| OpenSpec View (CLI) | Open CLI View |
| Show Change Comparison Timeline | Show Comparison |
| Generate Sprint Report... | Generate Report... |
| Show Change Details | Show Details |
| List Specs Summary | Show Specs |
| Open Process Dashboard | Open Dashboard |
| Refresh | Refresh Views |
| Remove This Leftover Directory | Delete Leftover |
| Remove This Working Directory | Delete Worktree |
| Say Something to This Run... | Send Message... |
| Stop This Run After a Task... | Stop Run... |
| Add Relation... | Add Relation... |
| Remove Relation... | Remove Relation... |
| Filter Archive... / Specs... / Change Graph... | Filter Archive... / Filter Specs... / Filter Graph... |
| Clear Archive / Specs / Change Graph Filter | Clear Archive Filter / Clear Specs Filter / Clear Graph Filter |
| Show / Hide Landed Relations | Show Relations / Hide Relations |
| Review Diff (tasks.md vs HEAD) | Show Diff |
| Cancel Process | Stop Process |
| Finish Implementation & Review | Finish Implementation |
| Rollback Process Changes | Rollback Process |
| Rollback Change | Rollback Change |
| Run Typecheck / Run Tests / Run Lint | Run Typecheck / Run Tests / Run Lint |

### The CLI's subcommands

| Now | Becomes |
| --- | --- |
| `validate` | `validate changes` |
| `run <change>` | `run change <change>` |
| `update <change>` | `update plan <change>` |
| `check <change>` | `run checks <change>` |
| `ready` | `show readiness` |
| `doctor` | `diagnose workspace` |
| `advise` | `show advice` |
| `lease` / `lease release` | `show lease` / `remove lease` |
| `status` | `show status` |
| `present` | `set presence` |
| `claim <resource>` | `set lock <resource>` |
| `stop <instanceId>` | `stop run <instanceId>` |
| `enrol [<keyId>]` | `confirm key [<keyId>]` |
| `join` | `join team` |
| `people` | `show people` |
| `history <change>` | `show history <change>` |
| `stages [<change>]` | `show stages [<change>]` |
| `owner <change>` | `set owner <change>` |
| `implementer <change>` | `set implementer <change>` |
| `send-back <change>` | `reopen change <change>` |
| `task done` / `task reopen` | `complete task` / `reopen task` |
| `task commit <change>` | `commit tasks <change>` |
| `answer <change>` / `answer <change> <Q-id> <text>` | `show questions <change>` / `answer question <change> <Q-id> <text>` |
| `worktree add` / `list` / `move` / `remove` | `create worktree` / `show worktrees` / `move worktree` / `delete worktree` |
| `change-graph` | `show graph` |
| `release-manifest` | `write manifest` |

Where a title names its noun loosely (Show Change in the Graph view means
"reveal this change in the Changes list"), the action's tooltip says what
it does; the title stays the pair.

### Amended on 2026-10-08

Carrying this out (every-action-is-a-verb-and-a-noun) showed two gaps, and
the tables above say what was done: three commands titled "Clear Filter"
would read alike in the palette, so each names its filter; and the nouns
gained Archive, the three filters, Changes and Change Copy.

### Amended on 2026-10-09

The icon was first the verb's. In the Changes view's title bar that put
the same picture two and three times side by side (Open Dashboard and Open
Pipeline; Run Typecheck, Run Tests and Run Lint), and the owner asked for
every icon to be unique: a picture two actions share tells neither apart.
So each action has its own icon, the verb gives the group and the colour,
and the test refuses two commands with one glyph.

### Amended on 2026-10-09 (a-change-is-acted-on-from-its-card)

The nouns gain Actions: a change's row in the Changes tree opens with
**Show Actions...**, which lists every action on the change, grouped, with ones that cannot run now saying why (ADR 0044).

### Amended on 2026-10-09 (every-control-is-a-verb-and-a-noun)

The web UI's buttons were named one at a time, as the commands had been:
"Start...", "Logs", "Catch up", "Show them", "Open all", "It was me",
"Clean old history". They follow the same rule now, in both hosts:

- A button outside a dialog is a pair: Run Change..., Show Logs, Update
  Main, Show Landed Changes, Show Tasks, Confirm Key, Delete History....
  Its accessible name starts with its visible words, and adds the change
  it is about: "Stop Run alpha".
- A button inside a dialog, or a prompt that already names what it is
  about, is the verb alone: Answer, Allow, Deny, Archive, Delete,
  Rollback, Cancel, Close. Every system dialog does the same.
- A switch (pressed or not, a tab, a choice of view) says what it shows,
  not an action: "By stage", "One change".
- A button with a Danger verb asks first in the web UI as well: Archive
  Landed Changes..., Delete History..., Rollback Process..., Delete
  Leftover..., Delete Worktree... and Delete Template... open a dialog
  before anything is deleted (ADR 0047).
- The verbs gain Schedule (Run) and Save (Set up), and the nouns the
  ones the buttons act on, listed above.

A test reads every `.tsx` source for its buttons' words and holds them to
the lists, and holds a Danger verb to its three dots.

## Consequences

- A user finds an action by its verb, and sees from the verb's group and
  colour what kind it is before reading it.
- Every new action is named by rule; the test refuses one that is not.
- Scripts and key bindings that used old names break once, and say how to
  fix it.
- The merge gate's own workflow, the README, HARNESS.md and the how-to
  pages move to the new names in the same change.

## Alternatives considered

- **Keep the old names as aliases.** Rejected by the owner: two
  vocabularies forever, for a small number of users who can adapt once.
- **Noun first (`change run`).** Rejected: the owner chose PowerShell's
  order, and the verb is what carries the group, colour and danger.
