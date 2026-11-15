# LinkedIn post: review-only-what-changed

Publish on 2026-12-17, three days after the site article on 2026-12-14.
Attach `docs/articles/site/review-only-what-changed/cover.png`.

## Post

You ask for a test covering a postal code with trailing spaces. The agent pushes a follow-up. The PR still shows the whole checkout change. How do you find the edits made since you last read it?

In OpenSpec Workbench, select **Mark as reviewed** on the commit you read. After the follow-up, **Show Changes Since Last Review** compares the saved SHA with the current local commit. You can inspect the revised scenario and test together, then return to the full PR diff for the merge review.

The walkthrough also shows why the SHA beside the CI results matters on a second pass.

Full write-up: https://openspec-ui.dev/articles/review-only-what-changed/
