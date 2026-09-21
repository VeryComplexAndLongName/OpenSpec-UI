## ADDED Requirements

### Requirement: The main checkout follows what landed

After its other work, the workspace sweep SHALL bring the default branch of
the checkout the host has open up to the remote's, by fast-forward alone,
unless `branches.followMain` is `false`. It SHALL do so only when all of
these hold:

- that checkout is the main working directory, on the default branch;
- its tree is clean;
- the default branch has no commits the remote lacks;
- no run is working in it.

Where the branch is behind and the move is refused, the sweep SHALL say how
far behind it is and why. Where the checkout is on another branch, the
sweep SHALL say nothing. It SHALL push nothing.

#### Scenario: A clean main is behind

- **WHEN** a pull request has landed and the owner's clean `main` is one
  commit behind
- **THEN** the sweep fast-forwards it and says it brought `main` up by one
  commit

#### Scenario: The tree holds work

- **WHEN** `main` is behind and its tree has an uncommitted edit
- **THEN** `main` is not moved, and the sweep says it is behind and that
  the tree is not clean

### Requirement: The drift names the changes not shown here

Where the checkout's default branch is behind, the drift reading SHALL
list the changes under way on the remote's default branch that the
checkout does not hold, and the drift line SHALL name them.

#### Scenario: A change landed while the checkout was behind

- **WHEN** a change is under way on `origin/main` and absent from the local
  `main`
- **THEN** the drift line says it is not shown here, by name

### Requirement: An archive pull request names what it archives

The title of a pull request the archive pass opens SHALL name the changes
it archives: every one of them up to two, and beyond two, the first two and
how many more.

#### Scenario: Four changes are archived

- **WHEN** the pass archives four changes
- **THEN** the title names the first two and says "and 2 more"
