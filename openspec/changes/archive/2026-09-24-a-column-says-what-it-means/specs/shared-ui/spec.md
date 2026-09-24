## MODIFIED Requirements

### Requirement: A card's state, progress and next step stand out

A card SHALL show its state word in a badge whose colour agrees with the
word, and SHALL NOT convey the state by colour alone. It SHALL show how many
of its change's tasks are done as a bar beside the count.

A card's controls SHALL be told apart by what they do: the control that moves
the change forward SHALL look different from a control that stops a run, and
both from a control that only copies. A control's accessible name SHALL NOT
change with its look.

Each column of the picture SHALL be headed by its place in the order, in
words true of every change in it whatever that change is doing: the first
column waits for nothing, and each other comes after the one before it. A
first column headed "can start now" read, over a change with every task
done, as advice to start it again (reported on 2026-09-23).

#### Scenario: A failed change beside a running one

- **WHEN** one change's last run failed and another's run is working
- **THEN** each card's badge carries its word, "Failed at verify" and
  "Running", in different colours, and each bar shows its tasks done

#### Scenario: A run waiting at a checkpoint on this host

- **WHEN** a run this host started waits to continue to verify
- **THEN** the card says so in a callout, "Continue to verify" is drawn as
  the forward control, and Stop is drawn as a stopping control

#### Scenario: Two columns

- **WHEN** one change waits on another
- **THEN** the first column is headed "Step 1 - waits for nothing", and the
  second "Step 2 - after step 1"

