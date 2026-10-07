## ADDED Requirements

### Requirement: A run's result reads once, as Markdown, in a log that reads as text

When an agent run completes with a summary, the AI panel SHALL say
`Completed` in its status line and SHALL draw the summary once, in a
Result section, rendered as Markdown. The run analysis SHALL NOT repeat the
summary. The log of what the run said SHALL leave out the `completed`
event, and the agent's last message where it is the summary again. In the
log, what the agent said SHALL be rendered as Markdown and drawn as text,
and a tool call SHALL be drawn as a quiet line, with no frame around either.
The run analysis SHALL count an ACP agent's tool calls.

#### Scenario: A review's result

- **WHEN** a review run ends with a summary holding a heading, bold text
  and a list, after the agent called two tools
- **THEN** the status line says `Completed`, the Result section shows the
  heading, the bold text and the list rendered, the run analysis says
  `Tool calls: 2` and does not hold the summary, and the log does not hold
  it either
