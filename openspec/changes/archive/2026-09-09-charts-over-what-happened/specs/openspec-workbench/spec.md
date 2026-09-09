## ADDED Requirements

### Requirement: What a project finished is readable as a chart

What a project finished and how long its changes took SHALL be readable
as a chart, in every host that shows the timeline.

Reading the shape of a project's work by opening its change directories
does not scale past the first few dozen; this repository carries 185.

Every chart SHALL state what it rests on: how many changes it drew, how
many were left out for having no date, and how many of its dates came
from a commit rather than from a naming convention. A chart that drops
the source plots an inference and a measurement identically, which is
the confusion the dates were built to remove.

A chart SHALL NOT be shown for a figure measured to be flat. A chart of
a quantity that is nearly always zero reads as a finding rather than as
an absence, and the absence is the finding.

Every chart's values SHALL also be readable as text, so what it shows
can be read by a screen reader and copied.

#### Scenario: Reading what was finished

- **WHEN** the timeline is shown for a set of changes
- **THEN** a chart shows how many were archived per day, with how many
  changes it rests on and where their dates came from

#### Scenario: A change with no date

- **WHEN** a change carries no archived date
- **THEN** it is excluded from the chart and counted as excluded, rather
  than plotted at a guessed date

#### Scenario: Reading a chart as text

- **WHEN** a chart is shown
- **THEN** the same values are present as text
