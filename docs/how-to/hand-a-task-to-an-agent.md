# Hand one numbered task to an agent

**Edit** the change's own `tasks.md`, and — only if you want a different
agent than the marker names — `openspec/changes/<id>/harness.json`,
creating that one if it is not there. Most changes have none.

**1.** Mark the item in `tasks.md` with the agent it waits on, and state
the evidence that agent has to write back into the item.

```markdown
- [ ] 5.4 **Delegated to `claude-cli`**: run the command against a live
  workspace. Evidence: the command and its output, quoted here.
```

**2.** Run it from the inbox: the standalone shell's "Waiting on
somebody" block, or **OpenSpec UI: Run This Delegated Item** in VS Code.
The row carries a **Run** only where the id names an agent this build
carries — an item waiting on a person is offered no button, because
there is nothing to press.

To give one task a different agent, or one of your own agent
definitions:

```json
{ "taskAgents": { "5.4": { "agent": "copilot-cli", "customAgent": "reviewer" } } }
```

The key is the task number exactly as `tasks.md` writes it. This key is
per-change only — a task number belongs to the change whose `tasks.md`
wrote it, so the same statement made workspace-wide would be about
different work in every change.

An item marked **Human-only** instead waits on a person, and no agent
closes it.

Accepted fields and how the id is validated:
[`HARNESS.md`](../../HARNESS.md).
