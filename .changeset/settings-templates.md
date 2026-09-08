---
"@openspec-ui/core": minor
"@openspec-ui/webui": minor
---

Offer harness configurations by intent. Three named templates — **Careful**,
**Overnight** and **Thrifty** — set agents, ceilings and autonomy together, so the
first experience of the harness is not a configuration exercise against eight
settings whose interactions are not obvious.

Each says what it is for **and when it is the wrong choice**, which is the
sentence that helps someone pick: "Overnight" states outright that it will spend
up to $25 and run for four hours without asking. Each also says where its numbers
came from, so a reader can disagree with the judgement and not with the
measurement.

The ceilings are measured, not chosen. Read from this repository's own audit log:
49 runs with a duration (median 7.7 min, p75 19.7, p90 34.9, longest 56.8) and 16
with a cost (median $1.94, p90 $7.14, largest $8.67). A ten-minute stage ceiling —
the round number a person reaches for — would have cut nearly a third of those
runs.

Every template is checked against the diagnostic that reports what a
configuration cannot do, and a template producing a finding fails the build. That
check is what separates a template from a suggestion: shipping a named
configuration whose ceiling cannot act would publish, in the product's own voice,
the confusion that diagnostic exists to report. Templates also declare their
scope, since three settings are refused in a global file.
