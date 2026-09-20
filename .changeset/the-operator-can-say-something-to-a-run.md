---
"@openspec-ui/core": minor
"openspec-ui-vscode": minor
---

The operator can say something to a run, and hear back. The signed channel
that carries a stop now also carries a note, a question and an answer: a run
takes what a person wrote at its next status renewal, hands it to its agent
in the prompt of the next stage it starts, and answers a question with what
that stage said. A run does not take another run's messages unless
`allowAgentMessages` says it may. In the editor, a change with a live run
gains "Say Something to This Run", and an answer addressed to you is shown
when it arrives.
