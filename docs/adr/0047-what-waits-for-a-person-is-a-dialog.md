# 0047: What Waits for a Person Is a Dialog

Status: Accepted

Date: 2026-10-09

## Context

What the web UI asks of a person is drawn where it happens to fit: the
answer to an agent's question, the reason for a Stop, the confirmation of a
Danger action and a change's action in the standalone app all appear as a
form below the Pipeline's picture; a run's logs below it too; Allow and
Deny in the run panel's flow. The owner, on 2026-10-09: to see what blocks
a run, one scrolls to the bottom of the Pipeline - and with many changes,
further - and nothing stops one from going elsewhere while a question
waits. "This applies to everything: block the person's actions and wait
for the answer, rather than let them switch anywhere."

A form below the picture also says nothing about which card it belongs to
once the card is out of sight, and two forms can be open at once.

## Decision

1. **What waits for a person's decision is a modal dialog.** It stands
   over the whole view, and the view behind it is dimmed and cannot be
   pressed. Focus moves into it, Tab stays in it, and focus returns to
   the control that opened it when it closes. It closes only by an answer,
   its Cancel, or Escape - never by a click beside it. Its title names the
   change and what is wanted ("Answer demo: 2 questions", "Delete Change
   demo?"). One dialog is open at a time.
2. **Opened by the person, it opens at once.** Answer..., Stop..., a Danger
   action, a change's action in the standalone app, Start's run dialog: the
   press opens the dialog.
3. **Asked by an agent, it is announced, not opened.** A question or a
   permission request arriving while the person is doing something else
   would take their typing mid-word, and an Enter meant elsewhere would
   answer it. So it is said in a banner at the top of the Pipeline and of
   the run panel - never scrolled away, whatever the number of changes -
   naming the change and how many things wait; the banner's Answer opens
   the dialog. The owner may later choose to open it at once; the banner
   stays the place it is announced.
4. **What a person asked to see opens as a dialog too.** A run's logs and
   an action's result are read over the view they were asked from, not
   below it; they close as any dialog does, and block nothing they were not
   asked about.
5. **One component, both hosts.** `packages/webui` holds one dialog, and
   every form above is drawn in it. The editor's own surfaces keep VS
   Code's modal message boxes and quick picks, which already behave so.
6. **A test holds it**: every form that waits for a person is drawn in the
   dialog component, modal, with its title; an agent's waiting question
   shows the banner at the top of the Pipeline.

## Consequences

- A person sees what blocks a run without scrolling, and cannot leave it
  half-answered by wandering off.
- Forms stop competing for the space below the picture.
- An agent's question never takes the keyboard from the person by itself.

## Alternatives considered

- **Open an agent's question at once, as a dialog.** Considered and set
  aside for now: it takes the keyboard from whatever the person was typing.
  The banner opens the same dialog one press later.
- **Keep the forms, and scroll to them.** Rejected: the view still lets the
  person go elsewhere, and a form scrolled to is scrolled away from again.
