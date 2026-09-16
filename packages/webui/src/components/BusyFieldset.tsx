// A tab's controls, held while the tab reads (a-screen-says-what-it-is-doing).
// A disabled fieldset disables every form control inside it natively, so no
// button has to be remembered one by one, and a screen reader hears each as
// unavailable. The stylesheet takes away the fieldset's own border and
// spacing, so wrapping controls in it changes nothing about how they sit.

import type { ReactNode } from "react";

export function BusyFieldset({ busy, children }: { busy: boolean; children: ReactNode }) {
  return (
    <fieldset className="openspec-busy-fieldset" disabled={busy} aria-busy={busy}>
      {children}
    </fieldset>
  );
}
