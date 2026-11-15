---
title: "Spot specification overlaps before Apply"
summary: "Use the Pipeline to find parallel OpenSpec changes that touch the same requirement before implementation starts."
cover: "cover.png"
cover_alt: "Two translucent drafting sheets overlap along one amber line."
---

Imagine two checkout changes that start from the same specification. One adds an address-formatting scenario. The other adds a rule for preserving the address after a failed payment. Their worktrees are separate, and each proposal looks reasonable when you read it alone. Both deltas still edit the same requirement.

If the second delta was drafted before the first landed, it can carry an older version of that requirement. The time to decide which scenarios belong together is while both plans are still cheap to change.

## Check the plan from the Pipeline

In OpenSpec Workbench 0.110.0 for VS Code or 1.66.0 standalone, commit the proposed delta and open its Pipeline card. Select **Show Spec Overlaps** before starting **Apply**. The report uses the same requirement analysis as **Show Archive Preview** and reads the committed Git data already available locally.

Look for two findings. **Changed on the default branch** means the requirement differs from the version at the common ancestor. **Also appears in** names another local change branch whose delta mentions the same requirement. The report shows the common-ancestor text, the locally known default-branch text and the proposed text where those versions are available.

## Decide what to do with the overlap

In the checkout example, open the two plans and agree who will carry the shared requirement forward. If both parts belong in one requirement, update the later delta against the current spec so it carries both the address-formatting and failed-payment scenarios. If one plan depends on the other, record that relationship and run them in order.

The report is advisory. It explains when the local history leaves part of the comparison unavailable. A branch the team has never fetched or checked out can still be missing from that local picture. Use **Show Archive Preview** later to inspect the predicted specification patch before the archive step. [OpenSpec Workbench release notes](https://github.com/VeryComplexAndLongName/OpenSpec-UI/releases/tag/openspec-ui-vscode%400.110.0)
