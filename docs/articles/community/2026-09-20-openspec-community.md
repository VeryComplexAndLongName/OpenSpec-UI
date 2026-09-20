# OpenSpec community: what to post, where, in what order

Everything here is for the owner to send. Nothing is sent by merging this file.
Each community has its own rules, read on 2026-09-20; they are quoted where they
matter. Do these in order: the first is what the second needs.

## 0. What is already there

- OpenSpec's own Community Showcase,
  [docs/community.md](https://github.com/Fission-AI/OpenSpec/blob/main/docs/community.md),
  already lists this project as "OpenSpec UI", described as a standalone web
  dashboard and VS Code extension for browsing changes, archives, specs and
  tasks. That is the old description and the old name. So this is a correction
  to an existing entry, which the page says it welcomes, not a new listing.
- awesome-openspec does not list this project at all.

## 1. A discussion on Fission-AI/OpenSpec (first)

OpenSpec's CONTRIBUTING says every change starts with a discussion or an issue,
and that "PRs without a linked issue or a prior discussion may be closed". So
the discussion comes before the pull request in step 2, and the pull request
links to it.

Post it at https://github.com/Fission-AI/OpenSpec/discussions, in Show and tell
if that category exists.

Title:

    OpenSpec Workbench: running and supervising agents on OpenSpec changes

Body:

    I have been building a tool on top of OpenSpec for my own workflow, and it is
    listed in the Community Showcase under its old name and old description
    ("OpenSpec UI", a dashboard for browsing changes). It has since grown into
    something different, so I would like to correct the entry. Before I open a
    pull request for that, I wanted to ask whether the wording below is right for
    the page.

    What it is: OpenSpec Workbench runs a coding agent CLI (Claude, Copilot,
    Codex, Gemini or a local model) on an OpenSpec change, shows what the run is
    doing while it does it, and lets a person stop it where its work is sound. It
    is a standalone local web application and a VS Code extension over the same
    core. It reads OpenSpec's files and runs your own agent CLIs; it needs no
    account and no paid service, and it never handles an API key.

    What it does not do: Codex and Gemini support has never been run against the
    real binaries, only against mocked peers. The repository and packages are
    still named OpenSpec-UI.

    Proposed line for docs/community.md:

    - **[OpenSpec Workbench](https://github.com/VeryComplexAndLongName/OpenSpec-UI)**: Runs and supervises coding agents on OpenSpec changes, from a local web app and a VS Code extension. Free; runs on your machine with your own agent CLIs.

    Disclosure, as CONTRIBUTING asks: I develop this with Claude Code, and the
    text of this post was drafted with its help and checked by me.

    Would you like the entry changed in any other way?

## 2. A pull request to Fission-AI/OpenSpec (after the discussion)

Edit `docs/community.md`: replace the existing "OpenSpec UI" line with the
proposed line above, unchanged unless the discussion asked for something else.
The page's rules: describe what people can use, no promotional claims or
referral or tracking links, and disclose paid features or required accounts (none
here). Link the discussion from the pull request, and say that the text was
drafted with Claude Code and checked by the owner.

Title: `docs: update the OpenSpec UI entry in the community showcase`

## 3. Discord (a short message, after the discussion)

Invite: https://discord.gg/YctCnvvshC. Post it in the channel for sharing what
you have built, if there is one, and read the channel's rules first.

    Hi all. I have been building a tool on top of OpenSpec for my own workflow:
    it runs a coding agent on a change, shows what the run is doing, and lets you
    stop it. It was listed in the Community Showcase as a dashboard; I have opened
    a discussion to correct that entry: <link to the discussion>.
    Feedback welcome, especially from anyone running agents on OpenSpec changes.

## 4. awesome-openspec (after the site has both articles)

A pull request to https://github.com/speclib/awesome-openspec, editing only
`README.md`. Its rules: the format is `[Name](URL) - Short description.`, one
sentence, the whole line under 150 characters, alphabetical order within the
section, working links.

Under "UIs", in the subsection that fits; the tool is both a web application and
an editor extension, so the maintainers may prefer another place. Alphabetical:
"OpenSpec Workbench" sorts before "openspec-ext", because a space sorts before a
hyphen. Check the neighbours on the day.

    - [OpenSpec Workbench](https://github.com/VeryComplexAndLongName/OpenSpec-UI) - Runs and supervises coding agents on OpenSpec changes.

Under "Articles & Tutorials":

    - [A viewer is not a cockpit](https://openspec-ui.dev/articles/a-viewer-is-not-a-cockpit/) - Why showing a change is not supervising an agent.
    - [Supervise agents on OpenSpec changes](https://openspec-ui.dev/articles/supervise-agents-on-openspec-changes/) - Running and stopping agents.

Pull request title: `Add OpenSpec Workbench and two articles`.

Body:

    Adds OpenSpec Workbench under UIs, and its two articles under Articles &
    Tutorials. It runs and supervises coding agents on OpenSpec changes, from a
    local web app and a VS Code extension. Actively maintained. Entries checked
    against the 150-character limit and placed alphabetically.

## What to leave out

No hashtags, no request for stars, likes or upvotes, and no link that carries a
tracking parameter, in any of these.

## Where each claim comes from

- What it is and what it needs: README, "Agent Selection" and "Install".
- That Codex and Gemini were never run against real binaries: README, "Agent
  Selection".
- That the current showcase entry says "OpenSpec UI": Fission-AI/OpenSpec,
  `docs/community.md`, read on 2026-09-20.
- The rules quoted: Fission-AI/OpenSpec `CONTRIBUTING.md` and
  `docs/community.md`, and speclib/awesome-openspec `CONTRIBUTING.md`, read on
  2026-09-20.