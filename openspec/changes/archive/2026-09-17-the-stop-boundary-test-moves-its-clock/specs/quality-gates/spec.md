## ADDED Requirements

### Requirement: A test on a faked clock moves that clock to what it waits for

Where a test fakes a timer and then waits for an effect of that timer, its
wait SHALL advance the faked clock far enough, on each attempt, for the timer
to fire again. It SHALL NOT rely on the clock reaching the timer through the
waiting helper's own small advances within a real-time limit.

A timer whose firing can be lost — because the work it starts is still in
flight from the previous firing — fires again only after its full interval,
and a wait that does not move the clock that far stalls, however long it is
allowed to wait in real time.

#### Scenario: A tick lost to a read still in flight

- **WHEN** a check interval fires while the previous check's read has not
  finished, and the test then waits for the check's effect
- **THEN** the wait moves the clock to the next firing and the effect is
  observed, rather than the wait timing out

#### Scenario: The effect never happens

- **WHEN** what the test waits for is actually broken
- **THEN** the wait fails within its stated budget, naming the assertion
