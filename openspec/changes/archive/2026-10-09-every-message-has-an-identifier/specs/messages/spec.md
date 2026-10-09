## ADDED Requirements

### Requirement: Every message is said by its identifier, from one register

A message the product says to a person SHALL have an identifier
`OSW-<GROUP>-<NNN>`, in one of the groups of ADR 0046, and an entry in the
register in core giving its level (`error`, `warning` or `info`), its words,
why it is said and what to do. Code SHALL say a message by its identifier
with its values, not as a sentence written in place. An identifier once
given SHALL stay in the register, marked retired when the message goes, and
SHALL NOT be given to another message. The groups `CLI`, `RUN`, `QST` and
`PRM` SHALL be in the register; other groups move into it in later changes.

#### Scenario: A message with its values

- **WHEN** the CLI refuses an answer to a question the change does not
  have
- **THEN** it says `error OSW-QST-003: Q-7 is not a question of demo`, from
  the register's entry and the values `Q-7` and `demo`

#### Scenario: An identifier given twice

- **WHEN** a change gives a new message an identifier the register has had
  before
- **THEN** the register's test fails

### Requirement: A message reads the same in every host

A message on a line of its own SHALL read `<level> <identifier>: <words>`.
After a mark that already says how a run ended - the CLI's `✗` and `■
cancelled:`, the output channel's `[failed]`, a panel's `Failed:` - the
identifier SHALL lead the words, `OSW-RUN-104: <words>`. The `progress`,
`failed` and `cancelled` events SHALL carry the identifier as `code`, beside
words that do not include it, and the CLI's JSON output SHALL carry it with
them. A panel SHALL show the identifier as a label that links to its entry
in `docs/messages.md`. A message not yet in the register SHALL read as it
did.

#### Scenario: An apply that did nothing

- **WHEN** a chain ends because its `apply` stage changed no file and
  ticked no task
- **THEN** the `failed` event carries `code: "OSW-RUN-104"`, the CLI prints
  `✗ OSW-RUN-104: "apply" changed no file ...`, and the panel shows `Failed:`
  with an `OSW-RUN-104` label linking to `docs/messages.md#osw-run-104`

#### Scenario: A CLI argument error

- **WHEN** `openspec-ui-cli validate changes --cwd` is run with no value
  after `--cwd`
- **THEN** it prints `error OSW-CLI-003: --cwd requires a value` and the
  usage, and exits 2

### Requirement: Every identifier is explained on a page

`docs/messages.md` SHALL be generated from the register and list, for every
identifier by group, its level and words, why it is said, and what to do. A
test SHALL fail while the checked-in page differs from what the register
generates.

#### Scenario: Looking up an identifier

- **WHEN** a person searches `docs/messages.md` for `OSW-QST-001`
- **THEN** they find what it says, that an agent's question is open, and
  how to answer it

### Requirement: Messages said in place only become fewer

A test SHALL count the messages still said as sentences written in place -
a literal to `stderr(`, to a VS Code notification, to `failedEvent(`, and a
literal `reason:` - across the packages' sources, and SHALL fail when the
count is above the number it holds, and when it is below, naming the new
number to hold.

#### Scenario: A new message said in place

- **WHEN** a change adds `deps.stderr("openspec-ui-cli: something")`
- **THEN** the count rises above the number held and the test fails until
  the message is in the register
