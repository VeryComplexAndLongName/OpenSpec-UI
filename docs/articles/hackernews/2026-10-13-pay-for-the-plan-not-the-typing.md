# Hacker News: Pay for the plan, not the typing

For the owner to post. Nothing is posted by merging this file. This is a
**regular submission**, not a second Show HN - the guidelines say a Show HN is
for something people can run, and a blog post belongs as an ordinary story.
Show HN was already used for the project's launch on 2026-09-29 and is a
once-per-project thing; a second one for the same repository would likely be
flagged.

## When

Sunday 2026-10-13, between 08:00 and 10:00 in New York (15:00-17:00 in
Moscow) - two days after the site article (2026-10-11), so this does not
read as the same announcement landing on three platforms in one day. Not the
same day as the Reddit posts (2026-10-14).

## Title

    Pay for the plan, not the typing

(33 characters. Unchanged from the article's own title, on purpose - HN's
guidelines ask for a title "close to the original" and warn against
editorializing; changing it to sound more clickable is the kind of thing that
gets a title replaced by a moderator.)

URL: https://openspec-ui.dev/articles/pay-for-the-plan-not-the-typing/

## First comment (a draft, to be rewritten by the owner)

    I write about OpenSpec Workbench, a harness that runs coding agents
    (Claude, Copilot, Codex, Gemini, DeepSeek) through a chain of stages -
    propose, review, apply, verify. Each stage can already run a different
    agent, at a different model and effort, so I tried splitting them by what
    they actually need: judgement on propose/review, which is cheap in volume
    and expensive per token if you want it done well; typing on apply, which
    is the opposite.

    The interesting part to me wasn't the savings estimate (current vendor
    prices put it around $65/month against paying for one top-tier
    subscription everywhere). It's what the harness's own telemetry can and
    cannot prove about it. Two of the three agents in the split report
    something that converts cleanly to a ceiling you can set - one in
    dollars, one in a vendor's own credit unit. The third, the cheap one
    doing the typing, reports nothing usable at all: no cost, no credits, no
    token count. There's no way to make the tool stop it once it's spending
    money, only a time limit.

    Also flagged in the piece: neither of the two cheaper CLIs asks for
    permission before writing files or running commands, despite the
    protocol they speak supporting it. Cheap isn't the same as supervised.

    Happy to answer questions about the setup, the harness.json shape, or
    what did not work (Codex and Gemini are in the product but have never
    been run against real binaries here).

## After posting

- Answer plainly, and say "I don't know" or "I haven't tried that" when true.
- Do not edit the title after it is posted.
- Do not ask anyone to upvote or comment, here or anywhere else.

## Where each claim comes from

- The article itself: `docs/articles/site/2026-10-11-pay-for-the-plan-not-the-typing.md`.
- That a Show HN is for something people can run, and a blog post is a
  regular submission: https://news.ycombinator.com/showhn.html, read
  2026-09-20 (see `docs/articles/hackernews/2026-09-29-show-hn.md`).
- Title guidelines (close to the original, not editorialized, no
  self-promotion beyond "part of the time"):
  https://news.ycombinator.com/newsguidelines.html, read 2026-09-24.
