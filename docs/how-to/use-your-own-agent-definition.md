# Use your own agent definition for a stage

**Edit** nothing of this product's to define one: the definitions are the
files your own CLI already reads.

**1.** Put the definition where that CLI reads it —
`.claude/agents/<name>.md` in the project or in your home directory for
Claude, `.github/agents/<name>.md` in the project for Copilot. The file
name is the agent's name.

**2.** Select it for a stage, in the Harness Settings view beside that
stage's agent, or by hand in
`openspec/changes/<id>/harness.json`:

```json
{ "stepAgents": { "review": { "agent": "claude-cli", "customAgent": "spec-reviewer" } } }
```

The picker lists only the definitions that stage's own CLI accepts, and
a stage whose agent takes none says so rather than showing an empty
control. A definition whose file name could not be passed as a flag
value is shown as found and not offered, with the reason — discovery and
validation say the same thing about the same name.

**Gemini and Codex cannot be given one**, and the reason is worth
knowing rather than being rediscovered: both read custom agents from
directories, but neither documents a flag that selects one for a single
non-interactive run. `HARNESS.md` records what each of them does accept,
with the date it was read.

Where definitions are discovered from, and the rule a name must pass:
[`HARNESS.md`](../../HARNESS.md).
