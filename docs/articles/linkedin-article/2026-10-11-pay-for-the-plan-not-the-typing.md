# LinkedIn Article (long-form): Pay for the plan, not the typing

## Title

Pay for the plan, not the typing

## Body

`stepAgents` has let OpenSpec Workbench name a different coding agent for
each stage of a chain - propose, review, apply, verify - since 0.42. What
changed is a reason to actually do it: those four stages do not cost the
same thing to run well, and they do not need to.

Deciding what a change should do, and reading whether the result is right,
both call for judgement. Writing the diff that gets there is comparatively
mechanical - not an insult to the work, just why a cheap, fast model does it
about as well as an expensive one. So the obvious split is a capable agent on
propose and review, and a cheap one on apply.

Here is that split, at today's prices - and the part worth reading past the
headline number: exactly what this project's own telemetry can prove about
the savings, and what it honestly cannot see at all.

**The harness.json.**

```
"stepAgents": {
  "propose": { "agent": "claude-cli-acp", "model": "claude-opus-5-5", "effort": "high", "budget": { "maxCostUsd": 5 } },
  "review":  { "agent": "claude-cli-acp", "model": "claude-opus-5-5", "effort": "high", "budget": { "maxCostUsd": 3 } },
  "apply":   { "agent": "deepseek-cli-acp" },
  "verify":  { "agent": "copilot-cli-acp", "effort": "medium", "budget": { "maxAiCredits": 200 } }
}
```

`propose` and `review` pin Claude Opus 5.5 at high effort, each with a dollar
ceiling. Claude Fable 5.1 is the other reasonable pick for either one -
cheaper per token, still built for judgement rather than throughput; which of
the two earns its price on your own changes is something to measure, not
assume. `apply` carries no model, no effort and no budget - not an
oversight. `deepseek-cli-acp` accepts none of the three: its model is a
session option this project's driver never sends, so DeepSeek's own default
runs, and nothing here can raise or lower how hard it thinks.

**What the harness can prove, and what it flatly cannot see.**

This is the part a "save money" post usually skips.

Two of the three agents in this split convert cleanly to a ceiling you can
actually set. `claude-cli-acp` reports a cost figure directly - measured
here on 2026-09-05, one stage: 60 input, 8,262 output and 1,693,507 cache
tokens, for $1.57. `copilot-cli-acp` reports no dollar figure, but it
reports AI Credits - not a proxy this project invented, but the unit
Copilot itself bills in, 1 credit = $0.01 - so a credit ceiling is a real
ceiling in real money, just denominated differently. Two agents, two
currencies, both enforceable.

`deepseek-cli-acp` is the one genuine blind spot: its one usage figure,
measured 2026-09-23, is a context gauge - how full its window is - never a
cost, a credit count or even a token split. A spending ceiling has no
mechanism to set on it, in either unit, because there is nothing to compare
it against.

So the honest description of the config above: three of the four stages
carry a leash denominated in real money - two in dollars, one in AI Credits
- and the cheap one does not. A stage timeout still bounds how *long* apply
can run, because elapsed time needs no report from the agent - but nothing
here will tell you, or stop you, if that stage is burning through a prepaid
DeepSeek balance faster than expected. That balance lives entirely on
DeepSeek's side. Watch it there.

Two more things worth knowing before you lean on the cheap stage. Neither
`copilot --acp` nor DeepSeek's own CLI asks for permission before writing a
file or running a command, despite the protocol both speak supporting the
mechanism - both were observed completing writes and shell commands here
without ever asking. Cheaper is not the same as better-supervised: the
review gate between apply and verify is what is actually watching this
stage. And DeepSeek's CLI needs a fairly recent Node - below the floor it
exits silently, with nothing on either stream, which is a strange first
symptom to debug if you are not expecting it.

**What this costs, at today's prices.**

Vendor list prices, read 2026-09-24 - not something this project measured,
and it has no opinion on which subscription you carry; that lives entirely
outside it, in each CLI's own login.

Claude Max (5x) alone: $100/month, every stage.
Claude Pro + Copilot Pro + a DeepSeek top-up: $20 + $10 + about $5 in tokens,
roughly $35/month - propose and review on Claude, apply on DeepSeek, verify
on Copilot.

Claude Pro is $20/month billed monthly, $17 annually. Claude Max starts at
$100 for the 5x tier. Copilot Pro is $10/month, including $10 of AI Credits.
DeepSeek carries no subscription at all: its current standard model prices
output around $0.60 per million tokens off-peak. Five dollars of prepaid
credit is, at that rate, upward of eight million output tokens - a lot, by
any measure, though this project has no apply-stage figure on DeepSeek to
compare it against directly; the honest unit here is tokens, not stages.

The arithmetic lands near $65 a month either way you compute it, and that
number is not fragile - it comes from the Claude Max-to-Pro step regardless
of exactly what Copilot or DeepSeek end up costing you.

**What this is not.** Not a benchmark - nothing here measured whether the
cheap agent produces work as good as the expensive one on the same stage.
Not a recommendation for every change: an architecture decision, or a
security-sensitive apply stage, may be exactly the case where the expensive
agent belongs everywhere, ceilings included.

The field reference, and which agent reports what, are in the project's
[HARNESS.md](https://github.com/VeryComplexAndLongName/OpenSpec-UI/blob/main/HARNESS.md)
and [LIMITS.md](https://github.com/VeryComplexAndLongName/OpenSpec-UI/blob/main/LIMITS.md).
The full write-up, with where every claim above comes from, is at
[openspec-ui.dev/articles/pay-for-the-plan-not-the-typing](https://openspec-ui.dev/articles/pay-for-the-plan-not-the-typing/).
The code: [github.com/VeryComplexAndLongName/OpenSpec-UI](https://github.com/VeryComplexAndLongName/OpenSpec-UI)
(the repository and packages are still named OpenSpec-UI; the product is
OpenSpec Workbench).

If you have split a coding agent's work across models or vendors by stage
rather than by project, I would like to know what you put where, and what
you found you could not actually verify once you did.

## Feed share text

A chain has four stages. Two of them need judgement, one is mostly typing,
and they do not have to run on the same agent - or cost the same.

I wrote up the split I am using in OpenSpec Workbench: an expensive model on
propose and review, a near-free one on apply. The part worth reading past the
headline saving: two of the three agents in the split report something that
converts to money - one in dollars, one in the vendor's own credit unit - so
the harness can put a ceiling on them. The cheap one reports nothing at all -
no cost, no tokens, no credits - so there is no ceiling in this tool that can
stop it once it starts. That balance lives on the vendor's own dashboard,
not here.

https://openspec-ui.dev/articles/pay-for-the-plan-not-the-typing/

---

## Not for posting

Everything below the line stays out of the Article and the feed share.

### What this is

LinkedIn's own long-form Article feature, not the short post-with-link
pattern the files in `docs/articles/linkedin/` use. LinkedIn renders it on its
own page, with its own title and cover image, so it carries the full piece
rather than a teaser. The Title and the Body are pasted into the Article; the
Feed share text is a separate, short post that links to it.

### When, and what to attach

Publish on 2026-10-15: a few days after the site page (2026-10-11), and after
the dev.to mirror if one goes out.
Cover image: `docs/articles/site/pay-for-the-plan-not-the-typing/cover.png`.
After publishing, share it to the feed once with the Feed share text above -
LinkedIn Articles get little reach without at least one share, and a second
share later reads as spam.

The repository link is in the Article's own body, not withheld to a first
comment the way the short posts do it: a long-form Article is read as a
destination in itself, and hiding the only link a reader would act on serves
no purpose here.

### Where each claim comes from

Identical to the site article's own "Where each claim comes from":
`docs/articles/site/2026-10-11-pay-for-the-plan-not-the-typing.md`.
