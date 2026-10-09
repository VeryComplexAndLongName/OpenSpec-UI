// A codicon, drawn from its outline (codicons.generated.ts), so a card shows
// an action with the icon its command has in VS Code's menus, in either host
// (a-change-is-acted-on-from-its-card). Coloured by the text around it.

import { CODICON_PATHS, CODICON_SIZE } from "../codicons.generated.js";

export function Codicon({ name }: { name: string }): JSX.Element | null {
  const path = CODICON_PATHS[name];
  if (path === undefined) return null;
  return (
    <svg className="openspec-codicon" viewBox={`0 0 ${CODICON_SIZE} ${CODICON_SIZE}`} aria-hidden="true" focusable="false">
      <path d={path} fill="currentColor" />
    </svg>
  );
}
