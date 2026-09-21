# Stop a run

A run is asked to stop, with a reason, and stops where its work is sound:
- at a checkpoint, at once;
- on a permission request, by denying it;
- inside a stage, at the next task marker that names another task, or the
  next ticked task.

Nothing is cut off mid-edit. Where it is asked from depends on which host
holds the run.

## A run this host holds

**1.** On the change's Pipeline card, press **Stop**: in the standalone
app's Pipeline tab, or in the editor's "OpenSpec Workbench: Open Pipeline" panel.

**2.** Give the reason, and press **Ask to stop**.

![The Ask to stop form on a Pipeline card](../images/standalone/pipeline-stop-ask.png)

The card then says the run was asked to stop, and by whom. The reason is
recorded in the run's status and in the chain's ending audit entry.

![A running change's card stating that it was asked to stop, with Stop now](../images/standalone/pipeline-stop.png)

**Stop now** appears once a stop has been asked. It cancels at once,
without waiting for a sound point. Use it only when waiting is worse than
an unfinished task.

## Stopping after a task, rather than now

Where the run should finish part of the change first, name the task:

```bash
openspec-ui-cli stop <instanceId> --reason "only up to 4.6" --after 4.6
```

The run keeps working and ends the moment 4.6 is ticked, or the moment its
agent says it is starting a task after it. It does not wait for a further
sound point: the tick of 4.6 is one. In the editor, the same request is
made from a change's row with **OpenSpec Workbench: Stop This Run After a Task**.

The run learns that 4.6 was ticked by reading the task list twice a second
while it holds the request, so there is a window of up to about half a
second in which an agent can begin 4.7. Ending before 4.7 is touched at
all is the agent's to do, not the runner's.

A task the change's list does not have is refused, and the run goes on: a
typo must not become "stop now".

## A run held somewhere else

A run started in another working directory, or by another host, offers
**Stop** on its card only when its record is signed by the person this
machine's key is enrolled as. That is you, on another checkout. A run
anyone else holds says whose it is, and offers only its folder path to
copy.

The request goes as a signed file, not as a command:
- **Reading it.** The run reads requests each time it renews its status
  record, every 5 seconds, and acts on one only if it is verified.
- **Freshness.** A request older than 60 seconds is refused as stale: a
  request kept for later is not the request a person made.
- **Once only.** A request already read is refused too.

Until the run reads it, the card says the stop was requested and that it
is waiting for the run to read it.

If your own runs read as not verified, enrol this machine's key first:
confirm **It was me** in the Human-Only Inbox, or run
`openspec-ui-cli enrol`.

## From a terminal

**1.** Find the run's instance id:

```bash
openspec-ui-cli status
```

**2.** Ask it to stop:

```bash
openspec-ui-cli stop <instanceId> --reason "wrong branch"
```

It prints the request's message id. It exits `1` when no live run reports
itself under that id, and the same signing, freshness and once-only rules
apply as for a card.

Every command and its exit codes: [README](../../README.md#ci-cli-merge-gate).
