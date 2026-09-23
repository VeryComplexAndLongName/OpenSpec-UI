## MODIFIED Requirements

### Requirement: The product merges its archive pull request itself

The sweep SHALL follow its open archive pull request and merge it itself.
It SHALL NOT ask any forge for an automatic merge. It SHALL read the
checks through the forge's `checksOf`:

- while checks are pending, it waits;
- where every check that ran passed, or none ran, it merges through
  `mergeNow`, trying squash, then merge, then rebase, and moves to the
  next method only where the forge refused the method;
- where a check failed, it does not merge, and names the check;
- where the forge refuses the merge for another reason, it leaves the pull
  request open and says the forge's reason.

The sweep SHALL follow such a pull request **whether or not anything is
left to archive**. A pass that finds nothing to archive SHALL still ask
the forge where an archive branch of this product's own is still on the
server, which it SHALL read offline from the refs a pruning fetch left.
Where no such branch is there, it SHALL ask the forge nothing, as before.

Following only while something was due is what orphaned an archive pull
request: once its changes were archived by another, no later pass looked
at it again, and it stayed open with its checks passing.

**One archive pass at a time SHALL run over a workspace on a machine.** A
pass SHALL take an advisory claim before archiving and release it after;
a pass that cannot take it SHALL leave the archive alone for that pass and
SHALL say who is archiving. The claim SHALL expire by heartbeat, and
anything that goes wrong reaching it SHALL leave the pass archiving as it
would without one.

Two hosts sweeping one workspace each opened an archive pull request for
the same changes within a minute: each read the forge's branches before
either had pushed, so neither could see the other.

The editor and the standalone server SHALL sweep again every five minutes
while an archive pull request is open. A pass that merges SHALL fetch, so
that the main checkout follows the archive in that same pass.

#### Scenario: A repository that does not allow automatic merge

- **WHEN** an archive pull request's checks have passed on a repository
  whose automatic merge is off
- **THEN** the sweep merges it

#### Scenario: A repository without checks

- **WHEN** an archive pull request has no check at all
- **THEN** the sweep merges it on the pass after it was opened

#### Scenario: A failed check

- **WHEN** a check of an archive pull request failed
- **THEN** the sweep does not merge it, and names the check

#### Scenario: A required approval

- **WHEN** the forge refuses the merge because an approval is required
- **THEN** the pull request stays open, the sweep says the forge's reason,
  and it tries again on the next pass

#### Scenario: Nothing left to archive, and one of ours still open

- **WHEN** a pass finds no change to archive and an archive branch of this
  product's own is still on the server
- **THEN** it asks the forge, follows that pull request, and merges it
  where its checks allow

#### Scenario: Nothing to archive and nothing of ours on the server

- **WHEN** a pass finds no change to archive and no archive branch of ours
  is on the server
- **THEN** the forge is not asked at all

#### Scenario: Another host is archiving

- **WHEN** a pass wants to archive and another host on this machine holds
  the archive claim
- **THEN** it archives nothing this pass, opens no pull request, and says
  who is archiving
