---
"@openspec-ui/core": minor
"@openspec-ui/webui": minor
"@openspec-ui/server": minor
"openspec-ui-vscode": minor
---

The Pipeline's board now shows every active change of the repository,
wherever it is worked: this working directory's and every other one's, one
card per change. A change worked in two places stands on the board once.

A card of another working directory says which directory works it and
where it stands, and offers no action on it - read here and never acted on
from here, as it has always been - and it is no longer drawn a second time
under "Other working directories". That section keeps its directories,
their branches and their runs.

A board is of the work, not of one folder: one person with several
worktrees has one flow of work, and a board showing a third of it is worse
than no board. Its heading is now "Changes". The arrangement by declared
order keeps to this checkout, because an order is what this repository
declares here.

The stages are read for every working directory and merged by name, since
a change that lives only in another worktree has no stage in this one -
and a change with no stage read would pile into Proposed and say something
untrue.
