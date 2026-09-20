# LinkedIn post: one core, two hosts

Publish on 2026-09-28: the site page is live from 2026-09-24, and this goes out a few days after it, not on the same day, and not on the day of the Show HN (2026-09-29).
Attach: `docs/articles/site/one-core-two-hosts/architecture.png`.
Put the repository link in the first comment, not in the post.

## Post

Ship the same tool as a VS Code extension and as a local web app, and the two quietly become two different products.

I decided early that all behaviour lives in one core, and each host is a thin adapter around it. What I rejected, in writing:

- running the web server inside the extension: dynamic ports, window collisions, authentication and process clean-up on the most common workflow
- implementing execution separately in each host
- storing a change's state in OpenSpec's own file format

"Thin" was not free, though. When an agent asked for permission in the middle of a chain, the core routed the cancel to the stage in flight but not the answer. The fix was in the core, and both hosts needed a matching branch. The run did not fail. It waited.

The write-up, with the diagram and where each claim comes from: https://openspec-ui.dev/articles/one-core-two-hosts/

If you have shipped one product in two hosts, what drifted first?

## First comment

The code, the issues and the extension: https://github.com/VeryComplexAndLongName/OpenSpec-UI
(The product is OpenSpec Workbench. The repository and packages are still called OpenSpec-UI.)

## Where each claim comes from

Not for posting.

- The decision, the three rejected alternatives and their reasons: `docs/adr/0001-shared-core-two-delivery-targets.md`.
- The permission answer that was routed to nobody, and both hosts gaining the matching
  branch: `docs/articles/2026-09-09-what-a-run-tells-you-0.40-to-0.44.md`, 0.40.
- The article itself: `docs/articles/site/2026-09-24-one-core-two-hosts.md`.