---
title: Every message has an identifier, from one register
published: false
description: What the product says to a person is now written in one register, every message carries an OSW-XXX code, and a generated page lets you look up the identifier you saw.
tags: openspec, devtools, typescript, opensource
cover_image: https://raw.githubusercontent.com/VeryComplexAndLongName/OpenSpec-UI/main/docs/articles/site/every-message-has-an-identifier-from-one-register/cover.jpg
canonical_url: https://openspec-ui.dev/articles/every-message-has-an-identifier-from-one-register/
---

*First published on [openspec-ui.dev](https://openspec-ui.dev/articles/every-message-has-an-identifier-from-one-register/).*

What the product says to a person — a failure's reason, a refusal, a CLI
error — was written where it is said, as a sentence. A person cannot look
up a message they saw, a host cannot act on one except by reading its
words, and nothing says which messages exist. A new register decides that
every message is said as `<level> OSW-<GROUP>-<NNN>: <message>`, from one
place, and that the register comes first with the groups `CLI`, `RUN`,
`QST` and `PRM`.

## The register, and what it holds

`message-register.ts` in core holds the 14 groups, every message's
identifier, level, words with named values, why it is said and what to
do. `say`, `formatMessage`, `withMessageCode`, `messageEntryUrl` are the
functions the rest of the product calls.

The `CLI`, `RUN`, `QST` and `PRM` messages are said from the register:
the CLI's argument errors, the chain's refusals, limits and endings, the
operator's questions, and the permission requests nobody can answer. Their
words do not change; the CLI's lines lose `openspec-ui-cli:` and gain the
form, `error OSW-CLI-003: --cwd requires a value`.

## A page you can search for

`docs/messages.md` is generated from the register: a page a person
searches for the identifier they saw. If you see `error OSW-RUN-042` in
your terminal or panel, you can look up what it means, why it was said,
and what to do about it, without guessing from the words alone.

## Codes on events and in JSON

`progress`, `failed` and `cancelled` events carry `code` beside their
words, and so does the CLI's JSON. The CLI, the output channel and the
panels put the identifier before the words; the panels show it as a label
that links to its entry.

## Tests that hold the line

Tests check that identifiers are well formed and in a group, that every
identifier ever given is kept, that the page matches what the register
says, and a ratchet on the messages still said in place — 323 before, 290
after, and it may only fall. This ratchet prevents new ad-hoc messages
from being added outside the register.

## Try it

The code is at
[github.com/VeryComplexAndLongName/OpenSpec-UI](https://github.com/VeryComplexAndLongName/OpenSpec-UI),
where the repository and packages keep the name OpenSpec-UI.

```bash
openspec-ui-cli run change --cwd . 2>&1 | grep 'OSW-'
```
