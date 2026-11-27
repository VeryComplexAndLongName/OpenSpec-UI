# Put a change aside in the Pipeline

Choose **Set Change Disposition** on the change's Pipeline card. Choose
**Deferred** to revisit it later or **Cancelled** to stop pursuing it. Enter
a reason, for example `Waiting for the next API version` or
`Replaced by remove-legacy-auth`, and save.

The **Deferred and cancelled changes** section displays the current decision
and its reason. Use the action on that row and choose **Active** to restore the
change. The standalone dialog shows the history. In VS Code, choose
**Show History** in the action's picker.

Workbench records each decision in
`openspec/changes/<change>/workbench-disposition.json` in the directory that
owns the change. Commit the file on that branch to share the decision. A
decision leaves the branch, worktree, artifacts, and main specifications
intact. A paused dependency remains unresolved. Restore a change to run
a Workbench chain or archive it.
