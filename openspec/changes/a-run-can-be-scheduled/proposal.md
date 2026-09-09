# A run can be asked for at a time, and says what happened to it

## Why

`one-way-in-to-run` left this open in as many words: the dialog is where
"now" and "at a time" belong, because they are the same question asked
once — but the timer is its own change, "with its own argument about what
happens when the process is not running".

That argument is the whole design. A timer inside a window that is closed
at the appointed hour fires nothing, and a schedule that quietly does not
happen is worse than no schedule: this project's own standard is that a
setting nothing reads is worse than no setting.

## Capabilities

### New

- A run can be asked for at a time rather than now, and starts at that
  time if the application is open.
- A run whose time passed while the application was closed starts when it
  is next opened, and says how late it is rather than pretending it ran
  on time.

## Out of scope

Running while nothing is running. That means handing the schedule to the
operating system — Task Scheduler or cron — which is a different feature
with different risks: credentials, environment, and a run nobody is
present for. Decided against for now; what ships says plainly that it
needs the application open, so nobody is promised otherwise.

Repeating schedules. Once is what the question asks; every night is a
different question, and answering it before anyone asks would be
inventing a use.
