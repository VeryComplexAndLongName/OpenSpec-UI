---
"@openspec-ui/core": minor
"@openspec-ui/webui": minor
---

The Pipeline shows what it has read.

The tab used to show nothing but "Reading what is running…" until this directory's own report arrived, and nothing but an error when that report failed — hiding other working directories whose survey had already come back. Each reading is now shown when it arrives: this directory's part says it is still being read, or why it could not be, in its own place, a picture already drawn stays under a later error, and the other working directories are drawn whatever became of it.

A card with more to say than room used to draw half a line at its bottom edge. A card now draws only whole lines. How many it holds is derived from its size, the way its position already is — core gains `PIPELINE_CARD_REM` and `pipelineCardDetailLines`, and the stylesheet is written from the same lengths. Each detail is one line with an ellipsis; lines past the budget stay on the card for assistive technology and in its title, and the last drawn line counts them ("+2").
