// The head of the standalone shell's page, above the tab row
// (the-shell-wears-the-site-frame, ADR 0033): a tagline beside an icon, the
// open tab's title as the page's one level-one heading, and what the tab is
// for. The application bar already names the product, so the heading names
// the page.

import type { PageHeadContent } from "../page-heads.js";
import { Icon } from "./Icon.js";

export function PageHead({ head }: { head: PageHeadContent }) {
  return (
    <div className="openspec-page-head" data-testid="page-head">
      <p className="openspec-page-head-tagline">
        <Icon meaning={head.icon} />
        {head.tagline}
      </p>
      <h1>{head.title}</h1>
      <p className="openspec-page-head-sentence">{head.sentence}</p>
    </div>
  );
}
