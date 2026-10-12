## MODIFIED Requirements

### Requirement: Every message is said by its identifier, from one register

A message the product says to a person SHALL have an identifier
`OSW-<GROUP>-<NNN>`, in one of the groups of ADR 0046, and an entry in the
register in core giving its level (`error`, `warning` or `info`), its words,
why it is said and what to do. Code SHALL say a message by its identifier
with its values, not as a sentence written in place. An identifier once
given SHALL stay in the register, marked retired when the message goes, and
SHALL NOT be given to another message. Every group of ADR 0046 SHALL have
its messages in the register: `CHG`, `RUN`, `QST`, `PRM`, `HRN`, `AGT`,
`TSK`, `VAL`, `ARC`, `GIT`, `WSP`, `KEY`, `NET`, `CLI` and `PRC`.

A carrier that says a sentence SHALL carry the identifier beside the words,
whatever the carrier is: a `reason:` field, a `refused(...)` result, a
`describe*` sentence formatter, a refusal error class
(`InvalidHarnessConfigError`, `ForgeRefusal`, `EnrolmentRefusedError`,
`Refused`, `ReportRefusal`), a `failedEvent(...)` line, a VS Code
notification, or a CLI `stderr(...)` line.

#### Scenario: A message with its values

- **WHEN** the CLI refuses an answer to a question the change does not
  have
- **THEN** it says `error OSW-QST-003: Q-7 is not a question of demo`, from
  the register's entry and the values `Q-7` and `demo`

#### Scenario: A harness setting that does not validate

- **WHEN** a change's harness configuration names an agent id no registered
  agent has
- **THEN** the validator throws an error whose text is the register's words
  and whose `code` is the register's identifier, `OSW-HRN-...`, and the
  host shows the identifier with the words

#### Scenario: An identifier given twice

- **WHEN** a change gives a new message an identifier the register has had
  before
- **THEN** the register's test fails

### Requirement: Messages said in place only become fewer

A test SHALL count the messages still said as sentences written in place
across the packages' sources, and SHALL fail when the count is above the
number it holds, and when it is below, naming the new number to hold. The
count SHALL cover every carrier that says a sentence - a literal to
`stderr(`, to a VS Code notification, to `failedEvent(`, a literal
`reason:`, a literal `message:` or `problem:` field, a `refused(...)`
reason, a `describe*` formatter's sentence, and a refusal error class's
message - not only the four forms the first ratchet counted. Widening the
count is a one-time re-baseline, recorded in the test's comment; after it,
the number SHALL only fall as each group moves into the register.

#### Scenario: A new message said in place

- **WHEN** a change adds `deps.stderr("openspec-ui-cli: something")`
- **THEN** the count rises above the number held and the test fails until
  the message is in the register

#### Scenario: A new carrier the ratchet does not count

- **WHEN** a change adds a refusal error class whose message is written in
  place
- **THEN** the widened ratchet counts it, and the count rises until the
  message is said by identifier
