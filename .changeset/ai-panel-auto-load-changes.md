---
"@openspec-ui/webui": patch
---

The AI panel now reads the OpenSpec change list automatically once it has a usable working directory, so the change picker is populated the moment the panel opens. Previously "Load changes" was an unlabelled precondition: until it was clicked the picker stayed empty and disabled, which blocked every command that needs a selected change. The button remains, relabelled "Reload changes", because changes can still appear on disk while the panel is open. Only the read-only `list` command is auto-run, never `plan`/`review`/`implement`, and the auto-read is skipped while another run is in flight so its output is not discarded.
