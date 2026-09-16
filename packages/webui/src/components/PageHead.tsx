// The head of the standalone shell's page, above the tab row
// (the-shell-wears-the-site-frame, ADR 0033): a tagline beside an icon, the
// open tab's title as the page's one level-one heading, and what the tab is
// for. The application bar already names the product, so the heading names
// the page. A tab may put one action at the head's right, as the mockup's
// summary does with Refresh (the-summary-looks-like-the-mockup).

import type { ReactNode } from "react";
import type { PageHeadContent } from "../page-heads.js";
import { Icon } from "./Icon.js";

export function PageHead({ head, action }: { head: PageHeadContent; action?: ReactNode }) {
  return (
    <div className="openspec-page-head" data-testid="page-head">
      <div className="openspec-page-head-text">
        <p className="openspec-page-head-tagline">
          <Icon meaning={head.icon} />
          {head.tagline}
        </p>
        <h1>{head.title}</h1>
        <p className="openspec-page-head-sentence">{head.sentence}</p>
      </div>
      {action ? <div className="openspec-page-head-action">{action}</div> : null}
    </div>
  );
}
