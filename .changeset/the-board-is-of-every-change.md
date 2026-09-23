---
"@openspec-ui/core": patch
"@openspec-ui/webui": patch
"@openspec-ui/server": patch
"openspec-ui-vscode": patch
---

The Pipeline's board is drawn whenever it is chosen, even with nothing on
it: six columns, headed and empty, and a line saying why they are empty.
Before this, a Pipeline with no change to draw answered with a note
instead of a picture, so pressing "By stage" changed nothing on screen -
which looks exactly like a control that does not work.

The board also no longer folds away what landed. The other arrangement
hides landed changes, which is right where landing is not a place; on a
board Landed is a column, so folding it empties that column by
construction, and on a checkout whose changes had all landed it emptied
the whole board.

Where a card says the same change is also worked elsewhere, the main
checkout is now called "the main working directory" rather than by its
label. That label is the name of whichever folder the repository was
cloned into, which says nothing about the place - and on this repository
read as the product's own name.
