## ADDED Requirements

### Requirement: What a change cost can be read after the run

The editor SHALL offer, for any change, a report of what has been spent
against it: each stage that ran, the agent and effort it ran with, what
it reported spending, and how long it took, together with a total.

It SHALL be available whether the change finished or not, and whether it
is active or archived. A change whose run was cut, failed, or exhausted
its attempts is the case where the question is most pressing, because
something was spent and nothing shipped.

A figure the agent did not report SHALL be shown as not reported, never
as zero, and a total SHALL be described as covering only what was
reported. Most supported agents report nothing at all, and a report
showing them as free would be wrong where a reader is least able to
check it.

A record that cannot be attributed to a stage SHALL be shown as
unattributed rather than dropped or assigned to a stage it might not
belong to: dropping it makes the total wrong, and guessing makes a row
wrong.

A change nothing has run against SHALL be reported as such rather than as
an empty table.

#### Scenario: A finished change is asked about

- **WHEN** a report is asked for a change whose chain completed
- **THEN** it shows each stage with its agent, effort, reported spend and
  duration, and a total

#### Scenario: A change that did not finish

- **WHEN** a report is asked for a change whose run was cut or failed
- **THEN** it still shows what was spent, and says how the run ended

#### Scenario: An agent that reported nothing

- **WHEN** a stage's agent reported no usage
- **THEN** that stage shows "not reported" rather than a zero, and the
  total says it covers only what was reported

#### Scenario: A record older than stage attribution

- **WHEN** the change has records that name no stage
- **THEN** they appear as unattributed and are still counted in the total

#### Scenario: Nothing has run

- **WHEN** a report is asked for a change with no records
- **THEN** it says nothing has run against this change
