## MODIFIED Requirements

### Requirement: A change's list entry says where the change stands

The Changes list SHALL show, for each change, one word that says where the
change stands across the repository, derived in `packages/core` from:

- this checkout's copy;
- every working directory's copy;
- the repository's main branch;
- the change's own branch;
- where it can be read, the branch's pull request.

The word SHALL come from the one closed set of state words that every
surface uses:

- Running, or running in a named directory;
- Waiting for you, or waiting in a named directory;
- Archived on main;
- Merged in a numbered pull request;
- Deleted on main;
- Further along in a named directory or on a named branch;
- Failed at a stage;
- Stopped at a stage;
- Done;
- Blocked;
- Ready.

The first word that applies, in that order, SHALL be shown. Whatever else
applies SHALL be stated in lines beneath it, each naming its source.

A colour SHALL agree with the word, and SHALL NOT be the only way the state
is shown.

The list SHALL state which ref was read as the main branch, when the
repository's refs were last fetched, and whether the last fetch or the
pull request reading failed.

Where the pull request reading failed, the reason SHALL name the cause
that `gh` gave. A refusal because no remote is on a GitHub host `gh` knows
SHALL NOT be stated as `gh` being signed out.

#### Scenario: A change archived on main

- **WHEN** a change is active in this checkout and archived on the main
  branch
- **THEN** its entry says "Archived on main", with a colour that agrees

#### Scenario: A change further along elsewhere

- **WHEN** another working directory's copy of a change has more tasks done
  than this checkout's copy
- **THEN** the entry says the change is further along there, and gives both
  counts and that directory's label

#### Scenario: Refs that could not be refreshed

- **WHEN** the last fetch failed
- **THEN** the list says so and when refs were last fetched, and still shows
  every standing it could read

#### Scenario: A remote that is not on GitHub

- **WHEN** `gh` refuses to list pull requests because no remote of the
  repository is on a GitHub host it knows, and `gh` is signed in
- **THEN** the list says pull requests were not read because no remote is on
  a GitHub host `gh` knows, and does not say `gh` is not signed in
