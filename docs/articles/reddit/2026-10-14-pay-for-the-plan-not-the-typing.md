# Reddit: Pay for the plan, not the typing

For the owner to post, by hand, in each subreddit's own posting form. Nothing
is posted by merging this file. This is the first piece in `reddit/` - the
directory was reserved for the campaign but never used before this.

**I could not read either subreddit's current rules from here**: reddit.com
is blocked for this session's tools (browser and fetch both refused it), so
nothing below about "what is allowed" is a claim this campaign can source the
way it sources everything else. Read each subreddit's sidebar/rules page
yourself immediately before posting, not from anything written here - Reddit
communities rewrite their self-promotion policy often enough that a rule read
even a month ago is not safe to rely on.

What the post follows regardless of the exact current wording, because it is
close to universal Reddit etiquette rather than one subreddit's rule: framed
as the finding, not the product; says up front that you built this; no
link-only submission; a title that is the finding, not an ad; genuinely
answer replies, including critical ones.

## When

Monday 2026-10-14, morning in the subreddit's own busiest timezone (both of
these skew US) - three days after the site article, one day after the Hacker
News submission, so this is not the same day as either.

---

## r/LocalLLaMA

**Title:**

    Splitting a coding agent chain by stage: expensive model plans, DeepSeek types it. Here's what I could and couldn't verify about the cost.

**Body:**

    I maintain OpenSpec Workbench, a harness that runs coding agent CLIs
    through a chain: propose, review, apply, verify. Each stage can run a
    different agent. I tried the obvious split - Claude Opus on propose and
    review, DeepSeek (over its ACP CLI, `dsh`) on apply - on the theory that
    deciding what to build needs judgement and writing the diff mostly
    doesn't.

    The part worth posting here rather than just linking: DeepSeek's CLI
    reports literally nothing usable for cost. Not a token split, not a
    credit count, nothing - the only figure it sends over the protocol is a
    context-window gauge. So there is no way for my harness to put a dollar
    ceiling on the DeepSeek stage; only a time limit binds it at all. Claude
    and Copilot both report something that converts cleanly to money (one in
    dollars, one in the vendor's own credit unit), so the harness can enforce
    a ceiling on those two, and is simply blind on the third.

    Also: `dsh` needs a fairly recent Node (22.18+/24.2+) or it exits with
    code 0 before answering, no output on either stream at all - a nasty
    first-run debugging experience if you don't expect it.

    Full write-up, with a worked config and today's vendor prices:
    https://openspec-ui.dev/articles/pay-for-the-plan-not-the-typing/

    Curious whether anyone here has actually benchmarked output quality
    between a cheap and expensive agent on the *same* apply-stage task - my
    article is explicit that I have not, and it's the obvious next question.

**Attach:** none - this is a text post, no image required.

---

## r/ClaudeAI

**Title:**

    I stopped running Claude Code on every stage of my agent chain - here's what its own cost reporting could and couldn't tell me

**Body:**

    Using Claude Code (via `claude-cli`/`claude-cli-acp`) as the planner and
    reviewer in an agent chain, and a cheaper CLI (DeepSeek, over ACP) for
    the actual code-writing stage - the idea being that deciding what to
    build rewards a strong model, and writing the diff is comparatively
    mechanical.

    What I actually wanted to share here: Claude Code's own cost reporting is
    the one piece of this that is fully trustworthy. `claude-cli-acp` reports
    a real dollar figure per stage - I measured one at $1.57 - and a
    `maxCostUsd` ceiling compares against exactly that number. That's not
    true of the other two agents in the chain: Copilot reports its own
    credit unit (still real money, just a different currency), and DeepSeek
    reports nothing at all - no cost, no tokens, nothing a ceiling can act
    on.

    So the honest takeaway wasn't "look how much I'm saving" - it's that
    Claude's cost reporting is the only one I'd trust to actually stop a run
    before it gets expensive. Full write-up, with the exact config and
    today's Claude Pro/Max prices:
    https://openspec-ui.dev/articles/pay-for-the-plan-not-the-typing/

    Would like to hear if anyone else has looked closely at what Claude Code
    reports vs. what it doesn't, especially around cache tokens - they're
    most of what one measured stage moved here, and they're excluded from
    the token ceiling entirely.

**Attach:** none - this is a text post, no image required.

---

## After posting, either subreddit

- Reply to real questions and real disagreement; do not reply only to
  agreement.
- No hashtags, no "please upvote", no cross-posting the exact same text to a
  third subreddit the same day.
- If either post is removed, do not repost it - read why it was removed and
  either drop it or come back with something materially different.

## Where each claim comes from

- The article itself: `docs/articles/site/2026-10-11-pay-for-the-plan-not-the-typing.md`.
- That reddit.com could not be read from this session, checked 2026-09-24:
  both the built-in browser and the fetch tool refused the domain outright.
- The $1.57 measurement, the DeepSeek context-gauge-only figure, and the
  Node floor: the article's own "Where each claim comes from" section, which
  cites `LIMITS.md` and `HARNESS.md` directly.
