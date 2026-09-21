## ADDED Requirements

### Requirement: A change's card opens its run logs

The standalone server SHALL answer `POST /api/run-logs/list` with an
authorized workspace's logged runs, one change's when the body names it,
and `POST /api/run-logs/read` with one run's log. It SHALL answer 400 for a
run id that could name a file outside the log directory, and 404 where no
log is kept.

The Pipeline SHALL offer Logs on every change's card. It SHALL open,
beneath the picture:

- the change's runs, newest first, each with when it started, what it
  was, the agent and how it ended;
- the chosen run's log, with each stage as a heading and the output of
  one stream joined.

It SHALL say so where no run of the change left a log.

#### Scenario: A person opens a change's logs

- **WHEN** a person presses Logs on a change's card
- **THEN** the change's runs are listed and the newest run's log is shown

#### Scenario: A change never ran

- **WHEN** no run of the change left a log
- **THEN** the view says that no run of this change has left a log
