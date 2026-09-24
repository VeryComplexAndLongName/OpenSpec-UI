---
"@openspec-ui/webui": patch
"@openspec-ui/server": patch
"openspec-ui-vscode": patch
---

Logs on a Pipeline card now opens where it can be seen. It opened beneath
the board and brought only its nearest edge into view, so on a board taller
than the window it showed 82 pixels of itself at the bottom edge, saying
"Reading the logs...", and the press seemed to do nothing. The logs now
open over the board, along the right side of the window, whatever its
height and scroll. The panel takes the focus, Escape closes it as Close
does, and the focus goes back to the Logs button that opened it. The
standalone and the editor's Pipeline panel both get this.
