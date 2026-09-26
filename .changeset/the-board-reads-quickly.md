---
"@openspec-ui/core": patch
"openspec-ui-vscode": patch
---

The board reads its stages about four times sooner: 9.1 s to 2.0 s on this
repository. Every change's proposal, task list and first commit are dated
from one `git log` of the working tree instead of three git runs per
change, a change renamed into place still keeps its first date, and the
working trees and their changes are read side by side.
