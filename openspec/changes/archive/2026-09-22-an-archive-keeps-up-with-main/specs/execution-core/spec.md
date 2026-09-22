## ADDED Requirements

### Requirement: An archive pull request keeps up with the default branch

Where the forge refuses to merge an open archive pull request while the
default branch has commits its branch does not, the sweep SHALL make the
archive again on the default branch as it is now, for the changes that
are due. It SHALL then move its own branch there with a lease on the
branch's current commit, and report that it did. It SHALL NOT do so
where a check failed, where the checks could not be read, or where the
default branch has not moved on. A refusal it cannot act on SHALL still
be reported with the forge's reason.

#### Scenario: A repository that merges only what is up to date

- **WHEN** another pull request lands after the archive pull request was
  opened, and the forge refuses the archive because it is behind
- **THEN** the archive branch is made again on the default branch and
  pushed, its checks run again, and a later pass merges it

#### Scenario: An approval is required

- **WHEN** the forge refuses the merge for an approval and the default
  branch has not moved
- **THEN** the archive branch is left as it was, and the refusal is
  reported
