## MODIFIED Requirements

### Requirement: A change's card opens its run logs

The standalone server SHALL answer `POST /api/run-logs/list` with an
authorized workspace's logged runs, one change's when the body names it,
and `POST /api/run-logs/read` with one run's log. It SHALL answer 400 for a
run id that could name a file outside the log directory, and 404 where no
log is kept.

The Pipeline SHALL offer Logs on every change's card. It SHALL open, over
the board and in view whatever the board's height and scroll:

- the change's runs, newest first, each with when it started, what it
  was, the agent and how it ended;
- the chosen run's log, with each stage as a heading and the output of
  one stream joined.

It SHALL say so where no run of the change left a log.

The view SHALL take the focus when it opens. Escape SHALL close it as its
Close button does, and closing it SHALL give the focus back to the Logs
button that opened it. A view opened beneath a picture taller than the
window is a press that seems to do nothing: reported on 2026-09-23, it
showed 82 pixels of itself at the window's bottom edge.

#### Scenario: A person opens a change's logs

- **WHEN** a person presses Logs on a change's card
- **THEN** the change's runs are listed and the newest run's log is shown

#### Scenario: A change never ran

- **WHEN** no run of the change left a log
- **THEN** the view says that no run of this change has left a log

#### Scenario: The board is taller than the window

- **WHEN** a person presses Logs on a card of a board taller than the window
- **THEN** the view is drawn over the board, whole within the window, with the focus in it

#### Scenario: A person closes the logs with Escape

- **WHEN** a person presses Escape in the logs view
- **THEN** the view closes and the focus is back on the Logs button that opened it
