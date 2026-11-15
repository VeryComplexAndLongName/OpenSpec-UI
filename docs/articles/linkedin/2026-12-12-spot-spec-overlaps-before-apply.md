# LinkedIn post: spot-spec-overlaps-before-apply

Publish on 2026-12-12, three days after the site article on 2026-12-09.
Attach `docs/articles/site/spot-spec-overlaps-before-apply/cover.png`.

## Post

Two agents can work in separate Git worktrees and still edit the same requirement. In a checkout flow, one change can add an address-formatting scenario while another preserves the address after a failed payment. Both plans can be valid until their requirement deltas meet.

Open **Show Spec Overlaps** from the OpenSpec Workbench Pipeline before **Apply**. It shows which locally known changes touch the same requirement and whether the default branch has changed it since they diverged. Use the report to decide which change carries the shared requirement forward.

The walkthrough uses both checkout changes to show what to look for.

Full write-up: https://openspec-ui.dev/articles/spot-spec-overlaps-before-apply/
